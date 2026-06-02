import { useState, useMemo } from 'react'
import {
  ShieldCheck, AlertTriangle, AlertCircle, Phone, Mail, ExternalLink,
  FileWarning, Clock, Euro, Users, Check, X, Copy,
  ChevronRight, Brain, RefreshCw, Send, Building2,
  CheckCircle2, TrendingDown, FileText, Gavel, Info, Loader2, TriangleAlert
} from 'lucide-react'

// ── Utility copies ────────────────────────────────────────────────────────────
const fmtEUR = (n) => '€\u00a0' + Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000)

const computeTotal = (items = []) => {
  let total = 0
  items.forEach(it => {
    const base = Number(it.quantity || 0) * Number(it.price || 0)
    let disc = 0
    if (it.discount && Number(it.discount.value) > 0) {
      disc = it.discount.type === 'percent' ? base * (Number(it.discount.value) / 100) : Number(it.discount.value)
    }
    const net = Math.max(0, base - disc)
    total += net * (1 + Number(it.btwRate || 0) / 100)
  })
  return total
}

const callClaude = async ({ system, prompt, apiKey, maxTokens = 2000 }) => {
  const resolvedKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANTHROPIC_API_KEY) || apiKey || null
  const headers = { 'Content-Type': 'application/json' }
  if (resolvedKey) {
    headers['x-api-key'] = resolvedKey
    headers['anthropic-version'] = '2023-06-01'
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`)
  }
  const data = await response.json()
  return data.content?.find(b => b.type === 'text')?.text || ''
}

// ── Risico berekening ─────────────────────────────────────────────────────────
function computeClientRisk(client, invoices, settings) {
  const cm = settings?.creditManagement || {}
  const threshold = Number(cm.latePaymentThreshold || 3)
  const highValue = Number(cm.highValueThreshold || 5000)
  const today = new Date()

  const clientInvoices = invoices.filter(i => i.clientId === client.id)

  // Facturen te laat betaald
  const latePayments = clientInvoices.filter(i => {
    if (i.status !== 'paid') return false
    if (!i.dueDate || !i.paidAt) return false
    return new Date(i.paidAt) > new Date(i.dueDate)
  })

  const avgDaysLate = latePayments.length > 0
    ? Math.round(latePayments.reduce((sum, i) => {
        return sum + Math.max(0, daysBetween(i.dueDate, i.paidAt))
      }, 0) / latePayments.length)
    : 0

  // Momenteel vervallen (open/verstuurd na vervaldatum)
  const overdueInvoices = clientInvoices.filter(i => {
    if (!['open', 'sent'].includes(i.status)) return false
    return i.dueDate && new Date(i.dueDate) < today
  })

  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + computeTotal(i.items || []), 0)

  // Openstaande hoge facturen (niet per se vervallen)
  const highValueOpenInvoices = clientInvoices.filter(i => {
    if (!['open', 'sent'].includes(i.status)) return false
    return computeTotal(i.items || []) >= highValue
  })

  // Risiconiveau bepalen
  let riskLevel = 'low'
  if (latePayments.length >= threshold || (totalOverdue >= highValue && overdueInvoices.length > 0)) {
    riskLevel = 'critical'
  } else if (latePayments.length >= Math.max(1, threshold - 1) || overdueInvoices.length > 1 || totalOverdue > highValue * 0.5) {
    riskLevel = 'high'
  } else if (latePayments.length >= 1 || overdueInvoices.length > 0) {
    riskLevel = 'medium'
  }

  const LABELS = { low: 'Laag risico', medium: 'Verhoogd', high: 'Hoog risico', critical: 'Kritisch' }

  return {
    lateCount: latePayments.length,
    latePayments,
    overdueInvoices,
    totalOverdue,
    avgDaysLate,
    highValueOpenInvoices,
    riskLevel,
    riskLabel: LABELS[riskLevel],
    caseRecommended: latePayments.length >= threshold,
    phoneCallRecommended: highValueOpenInvoices.length > 0 || (overdueInvoices.length > 0 && totalOverdue >= highValue),
    totalInvoices: clientInvoices.length,
  }
}

// ── Design tokens (same as main app) ─────────────────────────────────────────
const inp = {
  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
  borderRadius: '8px', color: 'var(--text)', padding: '9px 12px',
  fontSize: '13px', width: '100%', outline: 'none', boxSizing: 'border-box',
}

const Card = ({ children, style = {}, className = '' }) => (
  <div className={className} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', ...style }}>
    {children}
  </div>
)

// ── Risico badge ──────────────────────────────────────────────────────────────
const RISK_COLORS = {
  low:      { color: 'var(--success)',  bg: 'var(--success-soft)',  dot: '#10b981' },
  medium:   { color: 'var(--warning)',  bg: 'var(--warning-soft)',  dot: '#f59e0b' },
  high:     { color: '#f97316',         bg: 'rgba(249,115,22,0.12)', dot: '#f97316' },
  critical: { color: 'var(--danger)',   bg: 'var(--danger-soft)',   dot: '#ef4444' },
}

const RiskBadge = ({ level, label }) => {
  const c = RISK_COLORS[level] || RISK_COLORS.low
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: c.bg, color: c.color, padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ── Dossier Modal ─────────────────────────────────────────────────────────────
function CaseModal({ client, risk, settings, entity, onClose }) {
  const cm = settings?.creditManagement || {}
  const dc = cm.debtCollector || {}
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState('')

  const invoiceList = risk.overdueInvoices.map(i => {
    const total = computeTotal(i.items || [])
    const daysOverdue = daysBetween(i.dueDate, new Date().toISOString().split('T')[0])
    return `  - Factuur ${i.number || i.id}: ${fmtEUR(total)} — vervaldatum ${fmtDate(i.dueDate)} (${daysOverdue} dagen te laat)`
  }).join('\n')

  const lateList = risk.latePayments.slice(-5).map(i => {
    const total = computeTotal(i.items || [])
    const daysLate = daysBetween(i.dueDate, i.paidAt)
    return `  - Factuur ${i.number || i.id}: ${fmtEUR(total)} — ${daysLate} dagen na vervaldatum betaald (${fmtDate(i.paidAt)})`
  }).join('\n')

  const dossierText = `INCASSO DOSSIER
${'='.repeat(60)}
Datum: ${fmtDate(new Date().toISOString())}
Verzonden door: ${entity?.name || 'Onbekend'} — ${entity?.email || ''}

DEBITEUR
Naam: ${client.name}
${client.contactName ? `Contactpersoon: ${client.contactName}` : ''}
${client.address ? `Adres: ${client.address}, ${client.postal || ''} ${client.city || ''}` : ''}
${client.email ? `E-mail: ${client.email}` : ''}
${client.phone ? `Telefoon: ${client.phone}` : ''}
${client.kvk ? `KVK: ${client.kvk}` : ''}

OPENSTAANDE FACTUREN (${risk.overdueInvoices.length}x)
Totaal openstaand: ${fmtEUR(risk.totalOverdue)}

${invoiceList || '  Geen openstaande facturen'}

BETALINGSHISTORIE — EERDERE TE LATE BETALINGEN (${risk.lateCount}x totaal)
${lateList || '  Geen eerdere te late betalingen'}

GEMIDDELD ${risk.avgDaysLate} DAGEN TE LAAT

VERZOEK
Wij verzoeken u de vordering van ${fmtEUR(risk.totalOverdue)} te innen.
Bij vragen, neem contact op met ${entity?.name || ''} via ${entity?.email || ''}.
${entity?.phone ? `Tel: ${entity.phone}` : ''}
${'='.repeat(60)}`

  const copy = () => {
    navigator.clipboard.writeText(dossierText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const generateAiCoverLetter = async () => {
    const apiKey = settings.apiKey
    if (!apiKey && !import.meta.env.VITE_ANTHROPIC_API_KEY) {
      setAiSummary('Geen API key ingesteld. Stel VITE_ANTHROPIC_API_KEY in of voeg een key toe via Instellingen → AI.')
      return
    }
    setLoading(true)
    setAiSummary('')
    try {
      const result = await callClaude({
        apiKey,
        maxTokens: 600,
        system: 'Je bent een zakelijke assistent gespecialiseerd in incassobrieven. Schrijf professioneel, zakelijk Nederlands. Geen emojis.',
        prompt: `Schrijf een korte, professionele begeleidende brief (max 150 woorden) voor een incasso dossier naar een deurwaarder.

Crediteur: ${entity?.name || 'Ons bedrijf'}
Debiteur: ${client.name}${client.kvk ? ` (KVK: ${client.kvk})` : ''}
Totaal openstaand: ${fmtEUR(risk.totalOverdue)}
Aantal openstaande facturen: ${risk.overdueInvoices.length}
Aantal eerdere te late betalingen: ${risk.lateCount}
Gemiddeld ${risk.avgDaysLate} dagen te laat

Noem dat we eerder herinneringen hebben gestuurd. Verzoek de deurwaarder actie te ondernemen.`,
      })
      setAiSummary(result)
    } catch (e) {
      setAiSummary(`Fout: ${e.message}`)
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '640px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }} className="scrollable">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Gavel size={16} style={{ color: 'var(--danger)' }} />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Dossier aanmaken — {client.name}</h2>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>
              {risk.overdueInvoices.length} openstaande factuur{risk.overdueInvoices.length !== 1 ? 'en' : ''} · {fmtEUR(risk.totalOverdue)} · {risk.lateCount}x te laat betaald
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px' }}><X size={18} /></button>
        </div>

        {/* Debt collector info */}
        {(dc.company || dc.email) && (
          <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border-2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', display: 'flex', gap: '10px' }}>
            <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
              <strong>Sturen naar:</strong> {dc.company || dc.name}{dc.email && <> · <a href={`mailto:${dc.email}`} style={{ color: 'var(--accent)' }}>{dc.email}</a></>}{dc.phone && <> · {dc.phone}</>}
            </div>
          </div>
        )}

        {/* Dossier text */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '6px' }}>Dossier inhoud</label>
          <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', fontSize: '11px', color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, lineHeight: 1.6 }}>
            {dossierText}
          </pre>
        </div>

        {/* AI cover letter */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>AI begeleidingsbrief</label>
            <button
              onClick={generateAiCoverLetter}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-soft)', border: '1px solid var(--border-2)', borderRadius: '6px', padding: '5px 10px', color: 'var(--accent)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
            >
              {loading ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Genereren…</> : <><Brain size={11} /> Genereer via AI</>}
            </button>
          </div>
          {aiSummary && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {aiSummary}
            </div>
          )}
          {!aiSummary && !loading && (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-3)', border: '1px dashed var(--border-2)', borderRadius: '8px' }}>
              Klik op "Genereer via AI" voor een professionele begeleidingsbrief
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={copy} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--danger)', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            {copied ? <><Check size={13} /> Gekopieerd!</> : <><Copy size={13} /> Kopieer dossier</>}
          </button>
          {dc.email && (
            <a
              href={`mailto:${dc.email}?subject=Incasso dossier ${client.name}&body=${encodeURIComponent(dossierText)}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', color: 'var(--text-2)', fontSize: '13px', textDecoration: 'none', fontWeight: '600', cursor: 'pointer' }}
            >
              <Mail size={13} /> E-mail deurwaarder
            </a>
          )}
          <button onClick={onClose} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>Sluiten</button>
        </div>
      </div>
    </div>
  )
}

// ── AI Credit Analyse Modal ───────────────────────────────────────────────────
function AICreditModal({ client, risk, settings, entity, onClose }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const cm = settings?.creditManagement || {}

  const analyze = async () => {
    const apiKey = settings.apiKey
    if (!apiKey && !import.meta.env.VITE_ANTHROPIC_API_KEY) {
      setError('Geen API key ingesteld. Stel VITE_ANTHROPIC_API_KEY in of voeg een key toe via Instellingen → AI.')
      return
    }
    setLoading(true)
    setError('')
    setResult('')

    const invoiceSummary = risk.overdueInvoices.map(i => {
      const total = computeTotal(i.items || [])
      const daysLate = daysBetween(i.dueDate, new Date().toISOString().split('T')[0])
      return `Factuur ${i.number}: ${fmtEUR(total)}, ${daysLate} dagen te laat`
    }).join('; ')

    const hasGraydon = Boolean(cm.graydonApiKey)
    const dataSource = hasGraydon ? 'Graydon credit data (API key aanwezig)' : 'Lokale betalingshistorie'

    try {
      const res = await callClaude({
        apiKey,
        maxTokens: 1000,
        system: `Je bent een zakelijke kredietanalist. Je geeft een beknopte credit risico analyse van bedrijven op basis van betalingshistorie.
Geef altijd: 1) Credit Score (0-100), 2) Risiconiveau, 3) Samenvatting betalingsgedrag, 4) Advies voor facturatie aanpak, 5) Aanbevolen acties.
Schrijf professioneel, zakelijk Nederlands. Gebruik duidelijke koppen.`,
        prompt: `Analyseer dit bedrijf als crediteur:

Bedrijfsnaam: ${client.name}
${client.kvk ? `KVK: ${client.kvk}` : ''}
${client.country ? `Land: ${client.country}` : ''}
Databron: ${dataSource}

BETALINGSHISTORIE:
- Totaal facturen: ${risk.totalInvoices}
- Te laat betaald (historisch): ${risk.lateCount}x
- Gemiddeld ${risk.avgDaysLate} dagen te laat
- Momenteel openstaand: ${risk.overdueInvoices.length} factuur/facturen, totaal ${fmtEUR(risk.totalOverdue)}
${invoiceSummary ? `- Details: ${invoiceSummary}` : ''}
- Hoge facturen open (>€${cm.highValueThreshold || 5000}): ${risk.highValueOpenInvoices.length}x

INGESTELDE DREMPELWAARDEN:
- Escalatiegrens: ${cm.latePaymentThreshold || 3} te late betalingen
- Hoge factuurgrenzen: €${cm.highValueThreshold || 5000}

Geef een complete creditanalyse met score, advies en concrete aanbevelingen voor hoe wij met dit bedrijf moeten omgaan qua facturatie en betaaltermijnen.`,
      })
      setResult(res)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }} className="scrollable">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Brain size={16} style={{ color: 'var(--accent)' }} />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>AI Credit Analyse — {client.name}</h2>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>Analyseer betalingsgedrag en krijg een credit score + advies</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px' }}><X size={18} /></button>
        </div>

        {cm.graydonApiKey && (
          <div style={{ background: 'var(--success-soft)', border: '1px solid var(--border-2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--success)' }}>
            <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Graydon API geconfigureerd — analyse bevat externe bedrijfsdata</span>
          </div>
        )}

        {!cm.graydonApiKey && (
          <div style={{ background: 'var(--warning-soft)', border: '1px solid var(--border-2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--warning)' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Analyse op basis van lokale betalingshistorie. Voeg een Graydon API-key toe in Instellingen voor externe bedrijfsdata.</span>
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {!result && !loading && (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Brain size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: '0 0 18px' }}>
              Claude analyseert het betalingsgedrag van {client.name} en geeft een credit score, risicobeoordeling en advies.
            </p>
            <button
              onClick={analyze}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'var(--accent)', border: 'none', borderRadius: '9px', padding: '11px 20px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              <Brain size={14} /> Start analyse
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Loader2 size={28} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '12px' }} />
            <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>Analyse bezig…</div>
          </div>
        )}

        {result && (
          <div>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
              {result}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={analyze} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-soft)', border: '1px solid var(--border-2)', borderRadius: '7px', padding: '8px 12px', color: 'var(--accent)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                <RefreshCw size={12} /> Opnieuw
              </button>
              <button onClick={onClose} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '7px', padding: '8px 14px', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer' }}>Sluiten</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Client risico rij ─────────────────────────────────────────────────────────
function ClientRiskRow({ client, risk, settings, entity, onSendReminder, invoices }) {
  const [showCase, setShowCase] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const cm = settings?.creditManagement || {}

  if (risk.riskLevel === 'low' && risk.overdueInvoices.length === 0 && risk.lateCount === 0) return null

  const c = RISK_COLORS[risk.riskLevel] || RISK_COLORS.low

  return (
    <>
      {showCase && <CaseModal client={client} risk={risk} settings={settings} entity={entity} onClose={() => setShowCase(false)} />}
      {showAI && <AICreditModal client={client} risk={risk} settings={settings} entity={entity} onClose={() => setShowAI(false)} />}

      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
        {/* Avatar + naam */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px', flex: '1 1 180px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px', fontWeight: '700', color: c.color }}>
            {(client.name || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text)' }}>{client.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{client.email || client.phone || '—'}</div>
          </div>
        </div>

        {/* Risico info */}
        <div style={{ display: 'flex', flex: '1 1 300px', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <RiskBadge level={risk.riskLevel} label={risk.riskLabel} />

          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-3)', flexWrap: 'wrap' }}>
            {risk.overdueInvoices.length > 0 && (
              <span style={{ color: 'var(--danger)', fontWeight: '600' }}>
                {risk.overdueInvoices.length}× achterstallig · {fmtEUR(risk.totalOverdue)}
              </span>
            )}
            {risk.lateCount > 0 && (
              <span>{risk.lateCount}× te laat betaald{risk.avgDaysLate > 0 ? ` (gem. ${risk.avgDaysLate}d)` : ''}</span>
            )}
          </div>

          {/* Alerts */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {risk.phoneCallRecommended && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--warning-soft)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                <Phone size={10} /> Bel aanbevolen
              </span>
            )}
            {risk.caseRecommended && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--danger-soft)', color: 'var(--danger)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                <Gavel size={10} /> Dossier aanbevolen
              </span>
            )}
          </div>
        </div>

        {/* Acties */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          {risk.overdueInvoices.length > 0 && onSendReminder && (
            <button
              onClick={() => onSendReminder(risk.overdueInvoices[0], 0)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '7px', padding: '6px 10px', color: 'var(--text-2)', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
            >
              <Send size={11} /> Herinnering
            </button>
          )}
          <button
            onClick={() => setShowAI(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--accent-soft)', border: '1px solid var(--border-2)', borderRadius: '7px', padding: '6px 10px', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
          >
            <Brain size={11} /> Analyseer
          </button>
          {(risk.caseRecommended || risk.overdueInvoices.length > 0) && (
            <button
              onClick={() => setShowCase(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '7px', padding: '6px 10px', color: 'var(--danger)', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
            >
              <Gavel size={11} /> Dossier
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ── Hoofd CreditManagementView ────────────────────────────────────────────────
export default function CreditManagementView({ clients, invoices, settings, entity, onSendReminder }) {
  const [filter, setFilter] = useState('all') // 'all' | 'critical' | 'high' | 'medium'
  const cm = settings?.creditManagement || {}

  const clientsWithRisk = useMemo(() => {
    return clients.map(c => ({
      client: c,
      risk: computeClientRisk(c, invoices, settings),
    })).filter(({ risk }) => risk.riskLevel !== 'low' || risk.overdueInvoices.length > 0 || risk.lateCount > 0)
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 }
        return order[a.risk.riskLevel] - order[b.risk.riskLevel]
      })
  }, [clients, invoices, settings])

  const filtered = filter === 'all' ? clientsWithRisk : clientsWithRisk.filter(x => x.risk.riskLevel === filter)

  const stats = useMemo(() => {
    const all = clientsWithRisk
    return {
      critical: all.filter(x => x.risk.riskLevel === 'critical').length,
      high: all.filter(x => x.risk.riskLevel === 'high').length,
      medium: all.filter(x => x.risk.riskLevel === 'medium').length,
      totalOverdue: all.reduce((s, x) => s + x.risk.totalOverdue, 0),
      caseRecommended: all.filter(x => x.risk.caseRecommended).length,
      phoneRecommended: all.filter(x => x.risk.phoneCallRecommended).length,
    }
  }, [clientsWithRisk])

  if (!cm.enabled) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <ShieldCheck size={32} style={{ color: 'var(--text-3)', margin: '0 auto 14px', display: 'block' }} />
        <h3 style={{ color: 'var(--text)', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>Creditbeheer uitgeschakeld</h3>
        <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>Activeer creditbeheer via Instellingen → Creditbeheer.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '32px', fontWeight: '500', margin: '0 0 4px', letterSpacing: '-0.02em', color: 'var(--text)' }}>Creditbeheer</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
            Betalingsrisico's, achterstallige facturen en dossieraanmaak
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
        {[
          { label: 'Kritisch', value: stats.critical, color: 'var(--danger)', bg: 'var(--danger-soft)', icon: AlertTriangle },
          { label: 'Hoog risico', value: stats.high, color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: FileWarning },
          { label: 'Verhoogd', value: stats.medium, color: 'var(--warning)', bg: 'var(--warning-soft)', icon: Clock },
          { label: 'Totaal achterstallig', value: fmtEUR(stats.totalOverdue), color: 'var(--danger)', bg: 'var(--danger-soft)', icon: Euro },
          { label: 'Bel aanbevolen', value: stats.phoneRecommended, color: 'var(--warning)', bg: 'var(--warning-soft)', icon: Phone },
          { label: 'Dossier aanbevolen', value: stats.caseRecommended, color: 'var(--danger)', bg: 'var(--danger-soft)', icon: Gavel },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <Card key={i} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>{s.label}</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={13} style={{ color: s.color }} />
                </div>
              </div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: s.color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
            </Card>
          )
        })}
      </div>

      {/* Thresholds info */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: 'var(--text-3)' }}>
          <Info size={11} /> Escalatiegrens: {cm.latePaymentThreshold || 3}× te laat
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: 'var(--text-3)' }}>
          <Phone size={11} /> Bel-grens: €{cm.highValueThreshold || 5000}
        </span>
        {(cm.debtCollector?.company || cm.debtCollector?.name) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--success-soft)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: 'var(--success)' }}>
            <CheckCircle2 size={11} /> Deurwaarder: {cm.debtCollector.company || cm.debtCollector.name}
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <Card style={{ padding: '8px' }}>
        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `Alle (${clientsWithRisk.length})` },
            { id: 'critical', label: `Kritisch (${stats.critical})` },
            { id: 'high', label: `Hoog (${stats.high})` },
            { id: 'medium', label: `Verhoogd (${stats.medium})` },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: filter === f.id ? '600' : '500',
                background: filter === f.id ? 'var(--text)' : 'transparent', color: filter === f.id ? 'var(--bg)' : 'var(--text-3)' }}>
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Client list */}
      <Card>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <ShieldCheck size={28} style={{ color: 'var(--success)', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
              {filter === 'all' ? 'Geen risicoklanten' : 'Geen klanten in dit filter'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              {filter === 'all' ? 'Alle klanten betalen op tijd.' : 'Pas het filter aan.'}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
                {filtered.length} klant{filtered.length !== 1 ? 'en' : ''}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Gesorteerd op risico</span>
            </div>
            {filtered.map(({ client, risk }) => (
              <ClientRiskRow
                key={client.id}
                client={client}
                risk={risk}
                settings={settings}
                entity={entity}
                onSendReminder={onSendReminder}
                invoices={invoices}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
