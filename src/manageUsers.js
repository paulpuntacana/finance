// Gebruikersbeheer via de edge function `manage-users` (service role blijft server-side).
// De browser kan supabase.auth.admin.* niet aanroepen: dat vereist de service-role key.
import { supabase, isSupabaseConfigured } from './supabase'

// Haal een leesbare foutmelding uit een functions.invoke-fout
const readInvokeError = async (error) => {
  try {
    const body = await error?.context?.json?.()
    if (body?.error) return body.error
  } catch { /* geen JSON-body */ }
  const msg = error?.message || ''
  if (/Failed to send a request|Failed to fetch|not found/i.test(msg)) {
    return 'De functie "manage-users" is niet bereikbaar. Is hij al gedeployed?'
  }
  return msg || 'Onbekende fout bij gebruikersbeheer.'
}

// Nodig iemand uit voor een organisatie. Stuurt een uitnodigingsmail; de persoon kiest
// zelf een wachtwoord. Geeft { data, error } terug; error is altijd een Nederlandse string.
export const inviteUser = async ({ email, fullName, organizationId, role, accessType }) => {
  if (!isSupabaseConfigured) return { data: null, error: 'Supabase is niet geconfigureerd.' }
  const { data, error } = await supabase.functions.invoke('manage-users', {
    body: {
      action: 'invite',
      email: (email || '').trim(),
      full_name: (fullName || '').trim(),
      organization_id: organizationId,
      role,
      access_type: accessType,
      redirect_to: window.location.origin,
    },
  })
  if (error) return { data: null, error: await readInvokeError(error) }
  if (data?.error) return { data: null, error: data.error }
  return { data, error: null }
}

// Invite-code: 12 tekens uit een eenduidig alfabet (geen 0/O, 1/I/L), crypto-random.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const generateInviteCode = (length = 12) => {
  const out = []
  const max = 256 - (256 % CODE_ALPHABET.length) // geen modulo-bias
  while (out.length < length) {
    const buf = crypto.getRandomValues(new Uint8Array(length * 2))
    for (const b of buf) {
      if (b < max && out.length < length) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length])
    }
  }
  return out.join('')
}
