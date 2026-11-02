// manage-users — gebruikers uitnodigen voor een organisatie (server-side, service role).
//
// De browser kan supabase.auth.admin.* niet gebruiken (vereist de service-role key).
// Deze functie:
//   1. verifieert de JWT van de aanroeper,
//   2. controleert dat die org_owner van de doel-org is, of platform_admin (actief account),
//   3. stuurt een uitnodiging via auth.admin.inviteUserByEmail,
//   4. zet organization_id / role / access_type in het profiel (server-side).
//
// Request (POST, Authorization: Bearer <user JWT>):
//   { action: 'invite', email, full_name, organization_id, role, access_type?, redirect_to? }
// Response: 200 { user: { id, email } }  |  4xx/5xx { error: '<Nederlandse melding>' }
//
// Deploy: supabase functions deploy manage-users
// (SUPABASE_URL, SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY zijn standaard beschikbaar.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // geen cookies/credentials: auth via Bearer-token
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const ROLES = ['org_owner', 'accountant', 'employee', 'platform_admin']
const ACCESS_TYPES = ['owner', 'bewerk', 'meekijk']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Methode niet toegestaan' })

  // 1. Aanroeper verifiëren
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!jwt) return json(401, { error: 'Niet ingelogd' })

  const { data: authData, error: authErr } = await admin.auth.getUser(jwt)
  const caller = authData?.user
  if (authErr || !caller) return json(401, { error: 'Sessie ongeldig of verlopen. Log opnieuw in.' })

  const { data: callerProfile, error: profErr } = await admin
    .from('profiles')
    .select('id, role, organization_id, is_active')
    .eq('id', caller.id)
    .maybeSingle()
  if (profErr || !callerProfile || callerProfile.is_active === false) {
    return json(403, { error: 'Je account heeft geen toegang.' })
  }
  const isPlatformAdmin = callerProfile.role === 'platform_admin'

  // 2. Invoer valideren
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Ongeldige JSON' })
  }
  if (body.action !== 'invite') return json(400, { error: 'Onbekende actie' })

  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = String(body.full_name ?? '').trim().slice(0, 200)
  const role = String(body.role ?? 'employee')
  const accessType = String(body.access_type ?? (role === 'org_owner' ? 'owner' : 'meekijk'))
  const orgIdRaw = body.organization_id
  const organizationId = orgIdRaw ? String(orgIdRaw) : null

  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { error: 'Ongeldig e-mailadres' })
  if (!fullName) return json(400, { error: 'Naam is verplicht' })
  if (!ROLES.includes(role)) return json(400, { error: 'Ongeldige rol' })
  if (!ACCESS_TYPES.includes(accessType)) return json(400, { error: 'Ongeldig toegangstype' })
  if (organizationId && !UUID_RE.test(organizationId)) return json(400, { error: 'Ongeldige organisatie' })

  // 3. Autorisatie
  if (role === 'platform_admin' && !isPlatformAdmin) {
    return json(403, { error: 'Alleen een platformbeheerder kan platformbeheerders aanmaken.' })
  }
  if (!organizationId && !isPlatformAdmin) {
    return json(400, { error: 'Kies een organisatie.' })
  }
  if (!isPlatformAdmin) {
    const isOwnerOfOrg = callerProfile.role === 'org_owner' && callerProfile.organization_id === organizationId
    if (!isOwnerOfOrg) {
      return json(403, { error: 'Alleen de eigenaar van deze organisatie of een platformbeheerder kan accounts toevoegen.' })
    }
  }
  if (organizationId) {
    const { data: org } = await admin.from('organizations').select('id').eq('id', organizationId).maybeSingle()
    if (!org) return json(404, { error: 'Organisatie niet gevonden' })
  }

  // redirect_to: alleen http(s); Supabase accepteert hem alleen als hij in de Redirect URLs staat.
  let redirectTo: string | undefined
  if (typeof body.redirect_to === 'string') {
    try {
      const u = new URL(body.redirect_to)
      if (u.protocol === 'https:' || u.protocol === 'http:') redirectTo = u.origin
    } catch { /* negeren */ }
  }

  // 4. Uitnodigen. Bestaande accounts worden bewust NIET verplaatst (zou overname mogelijk maken).
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  })
  if (inviteErr || !invited?.user) {
    const msg = inviteErr?.message || ''
    if (/already|registered|exists/i.test(msg)) {
      return json(409, { error: 'Er bestaat al een account met dit e-mailadres. Laat deze persoon aansluiten met de uitnodigingscode van de organisatie.' })
    }
    if (/rate limit/i.test(msg)) return json(429, { error: 'Te veel uitnodigingen verstuurd. Probeer het later opnieuw.' })
    console.error('inviteUserByEmail failed:', msg)
    return json(500, { error: 'Uitnodiging versturen mislukt.' })
  }

  // 5. Profiel instellen (handle_new_user maakt het aan; upsert voor de zekerheid)
  const { error: upsertErr } = await admin.from('profiles').upsert({
    id: invited.user.id,
    email,
    full_name: fullName,
    role,
    access_type: accessType,
    organization_id: organizationId,
    is_active: true,
  }, { onConflict: 'id' })
  if (upsertErr) {
    console.error('profile upsert failed:', upsertErr.message)
    return json(500, { error: 'Uitnodiging verstuurd, maar het profiel kon niet worden ingesteld. Neem contact op met de beheerder.' })
  }

  return json(200, { user: { id: invited.user.id, email } })
})
