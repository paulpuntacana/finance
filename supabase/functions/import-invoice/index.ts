import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // Token uit Authorization header
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // Zoek gebruiker op via token
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('user_id, org_id')
    .eq('api_token', token)
    .maybeSingle()

  if (settingsError || !settings) {
    return new Response(
      JSON.stringify({ error: 'Ongeldig token' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const { org_id } = settings

  // Parse request body
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Ongeldige JSON in request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  // Verplichte velden
  const { supplier, date, amount_excl } = body
  if (!supplier || !date || amount_excl === undefined || amount_excl === null) {
    return new Response(
      JSON.stringify({ error: 'Verplichte velden ontbreken: supplier, date, amount_excl' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const btwRate   = parseFloat(String(body.btw_rate ?? 0))
  const amountExcl = parseFloat(String(amount_excl))
  const btwAmount  = body.btw_amount !== undefined
    ? parseFloat(String(body.btw_amount))
    : parseFloat((amountExcl * btwRate / 100).toFixed(2))
  const totalAmount = body.total_amount !== undefined
    ? parseFloat(String(body.total_amount))
    : parseFloat((amountExcl + btwAmount).toFixed(2))

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('purchase_invoices')
    .insert({
      org_id,
      supplier:        String(supplier),
      invoice_number:  body.invoice_number ? String(body.invoice_number) : null,
      date:            String(date),
      due_date:        body.due_date ? String(body.due_date) : null,
      amount_excl:     amountExcl,
      btw_rate:        btwRate,
      btw_amount:      btwAmount,
      total_amount:    totalAmount,
      currency:        body.currency ? String(body.currency) : 'EUR',
      category:        body.category ? String(body.category) : 'Software & Abonnementen',
      notes:           body.notes ? String(body.notes) : null,
      attachment_url:  body.attachment_url ? String(body.attachment_url) : null,
      attachment_name: body.attachment_name ? String(body.attachment_name) : null,
      status:          'unpaid',
      extra:           {},
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Insert error:', insertError)
    return new Response(
      JSON.stringify({ error: insertError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  return new Response(
    JSON.stringify({ success: true, id: inserted.id }),
    { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
})
