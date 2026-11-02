// import-invoice — Make.com (of andere tool) plaatst een inkoopfactuur in het juiste account.
//
// Authenticatie: persoonlijk API-token (Authorization: Bearer <token>).
// Alleen de SHA-256-hash van het token staat in user_settings.api_token_hash (migratie v7).
// De organisatie wordt NIET uit user_settings.org_id gehaald, maar uit het actieve profiel
// van de token-eigenaar (profiles.organization_id, is_active = true).
//
// Response (ongewijzigd): 201 { success: true, id }  |  4xx/5xx { error }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Server-naar-server endpoint: geen cookies/credentials, alleen POST.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const sha256Hex = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Getal uit body: accepteert 12.5 / "12.5" / "12,50". Geeft null bij ongeldig.
const toNumber = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const round2 = (n: number) => Math.round(n * 100) / 100
const str = (v: unknown, max = 500) => (v === undefined || v === null || v === '' ? null : String(v).slice(0, max))
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_AMOUNT = 100_000_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method Not Allowed' })

  // Token uit Authorization header
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()
  if (!token || token.length < 32 || token.length > 200) {
    return json(401, { error: 'Missing Authorization header' })
  }

  // Token → gebruiker (via hash)
  const tokenHash = await sha256Hex(token)
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('user_id')
    .eq('api_token_hash', tokenHash)
    .maybeSingle()
  if (settingsError || !settings?.user_id) return json(401, { error: 'Ongeldig token' })

  // Gebruiker → organisatie (alleen actief profiel met schrijfrechten op financiële data)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, role, access_type, is_active')
    .eq('id', settings.user_id)
    .eq('is_active', true)
    .maybeSingle()
  if (profileError || !profile?.organization_id) {
    return json(403, { error: 'Account is niet actief of niet gekoppeld aan een organisatie' })
  }
  const canWrite = profile.role === 'platform_admin' ||
    (['org_owner', 'accountant'].includes(profile.role) && (profile.access_type ?? 'owner') !== 'meekijk')
  if (!canWrite) return json(403, { error: 'Dit account mag geen inkoopfacturen toevoegen' })
  const org_id = profile.organization_id

  // Body parsen
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Ongeldige JSON in request body' })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { error: 'Ongeldige JSON in request body' })
  }

  // Verplichte velden
  const { supplier, date, amount_excl } = body
  if (!supplier || !date || amount_excl === undefined || amount_excl === null) {
    return json(400, { error: 'Verplichte velden ontbreken: supplier, date, amount_excl' })
  }
  if (!ISO_DATE.test(String(date))) return json(400, { error: 'date moet het formaat JJJJ-MM-DD hebben' })
  if (body.due_date && !ISO_DATE.test(String(body.due_date))) {
    return json(400, { error: 'due_date moet het formaat JJJJ-MM-DD hebben' })
  }

  // Getallen valideren
  const amountExcl = toNumber(amount_excl)
  if (amountExcl === null || Math.abs(amountExcl) > MAX_AMOUNT) return json(400, { error: 'amount_excl is geen geldig bedrag' })

  const btwRate = body.btw_rate === undefined || body.btw_rate === null || body.btw_rate === '' ? 0 : toNumber(body.btw_rate)
  if (btwRate === null || btwRate < 0 || btwRate > 100) return json(400, { error: 'btw_rate moet tussen 0 en 100 liggen' })

  let btwAmount = round2(amountExcl * btwRate / 100)
  if (body.btw_amount !== undefined && body.btw_amount !== null && body.btw_amount !== '') {
    const v = toNumber(body.btw_amount)
    if (v === null || Math.abs(v) > MAX_AMOUNT) return json(400, { error: 'btw_amount is geen geldig bedrag' })
    btwAmount = round2(v)
  }

  let totalAmount = round2(amountExcl + btwAmount)
  if (body.total_amount !== undefined && body.total_amount !== null && body.total_amount !== '') {
    const v = toNumber(body.total_amount)
    if (v === null || Math.abs(v) > MAX_AMOUNT) return json(400, { error: 'total_amount is geen geldig bedrag' })
    totalAmount = round2(v)
  }

  const currency = body.currency ? String(body.currency).trim().toUpperCase() : 'EUR'
  if (!/^[A-Z]{3}$/.test(currency)) return json(400, { error: 'currency moet een ISO-code zijn (bijv. EUR)' })

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('purchase_invoices')
    .insert({
      org_id,
      supplier:        String(supplier).slice(0, 200),
      invoice_number:  str(body.invoice_number, 100),
      date:            String(date),
      due_date:        str(body.due_date, 10),
      amount_excl:     round2(amountExcl),
      btw_rate:        btwRate,
      btw_amount:      btwAmount,
      total_amount:    totalAmount,
      currency,
      category:        str(body.category, 100) ?? 'Software & Abonnementen',
      notes:           str(body.notes, 2000),
      attachment_url:  str(body.attachment_url, 2000),
      attachment_name: str(body.attachment_name, 300),
      status:          'unpaid',
      extra:           {},
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Insert error:', insertError)
    return json(500, { error: 'Opslaan mislukt' })
  }

  return json(201, { success: true, id: inserted.id })
})
