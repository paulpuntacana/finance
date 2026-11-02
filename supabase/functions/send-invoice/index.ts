// send-invoice — verstuurt een factuur-e-mail met PDF-bijlage via Resend.
//
// NOG NIET GEKOPPELD AAN DE UI. De app gebruikt nu: PDF downloaden → mailprogramma openen →
// "Markeer als verstuurd". Deze functie is het fundament om later direct te versturen.
//
// Deploy:   supabase functions deploy send-invoice
// Secrets:  supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="DHS Finance <facturen@jouwdomein.nl>"
//
// Request (POST, Authorization: Bearer <Supabase access token van de ingelogde gebruiker>):
//   { to: string, subject: string, html: string, pdfBase64: string, filename: string, replyTo?: string }
// Response: { id } (Resend message id) of { error }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } })

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const MAX_PDF_BYTES = 8 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  // ── Auth: alleen ingelogde gebruikers van deze Supabase-app ───────────────
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!jwt) return json({ error: 'Missing Authorization header' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !user) return json({ error: 'Not authenticated' }, 401)

  // ── Input ─────────────────────────────────────────────────────────────────
  let payload: { to?: string; subject?: string; html?: string; pdfBase64?: string; filename?: string; replyTo?: string }
  try { payload = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const { to, subject, html, pdfBase64, filename, replyTo } = payload
  if (!to || !EMAIL_RE.test(to)) return json({ error: 'Invalid "to" address' }, 400)
  if (!subject || !html) return json({ error: '"subject" and "html" are required' }, 400)
  if (!pdfBase64 || !filename) return json({ error: '"pdfBase64" and "filename" are required' }, 400)
  if (pdfBase64.length * 0.75 > MAX_PDF_BYTES) return json({ error: 'PDF too large' }, 413)
  const safeFilename = filename.replace(/[^\w.\- ]+/g, '_').slice(0, 120)

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM')
  if (!apiKey || !from) return json({ error: 'RESEND_API_KEY / RESEND_FROM not configured' }, 500)

  // ── Versturen via Resend ──────────────────────────────────────────────────
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      reply_to: replyTo && EMAIL_RE.test(replyTo) ? replyTo : user.email,
      attachments: [{ filename: safeFilename.endsWith('.pdf') ? safeFilename : `${safeFilename}.pdf`, content: pdfBase64 }],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return json({ error: data?.message || `Resend error ${res.status}` }, 502)
  return json({ id: data?.id })
})
