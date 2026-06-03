import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Plus, FileText, Edit3, Trash2, Check, X, ChevronRight,
  Copy, Send, Clock, AlertCircle, CheckCircle2,
  ArrowRight, FileCheck2, Link2, Loader2, Printer, Pen, History,
  Sparkles, Building2, FileSignature, Upload,
  BookOpen, Presentation, Film, Globe, Type,
  PenLine, CalendarDays, Layout, Settings2, Mail, MessageCircle
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Local storage hook
// ─────────────────────────────────────────────────────────────────────────────
const useLocalStorage = (key, def) => {
  const [v, setV] = useState(() => {
    try { const r = localStorage.getItem(key); return r !== null ? JSON.parse(r) : def } catch { return def }
  })
  const set = val => {
    const r = typeof val === 'function' ? val(v) : val
    setV(r)
    try { localStorage.setItem(key, JSON.stringify(r)) } catch (e) { console.warn('Storage:', e) }
  }
  return [v, set]
}

// ─────────────────────────────────────────────────────────────────────────────
// AI helper
// ─────────────────────────────────────────────────────────────────────────────
const callAI = async (apiKey, system, userMsg) => {
  const key = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANTHROPIC_API_KEY) || apiKey
  if (!key) throw new Error('Geen API sleutel ingesteld. Ga naar Instellingen → AI.')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.error?.message || `API fout (${r.status})`)
  }
  return (await r.json()).content[0]?.text || ''
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
const fmtEUR = n => '€\u00a0' + Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const todayISO = () => new Date().toISOString().split('T')[0]
const addDays = (iso, days) => { const d = new Date(iso); d.setDate(d.getDate() + Number(days)); return d.toISOString().split('T')[0] }
const genId = () => `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const genToken = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
const genEsignToken = () => 'esign_' + genToken()
const computeQuote = (items = []) => {
  let sub = 0, btw = 0
  items.forEach(it => {
    const n = Number(it.quantity || 0) * Number(it.price || 0)
    sub += n; btw += n * (Number(it.btwRate || 0) / 100)
  })
  return { subtotal: sub, btwTotal: btw, total: sub + btw }
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const STATUSES = {
  draft:    { label: 'Concept',       color: 'var(--text-2)',  bg: 'var(--surface-3)',   icon: FileText },
  sent:     { label: 'Verstuurd',     color: 'var(--accent)',  bg: 'var(--accent-soft)', icon: Send },
  accepted: { label: 'Geaccepteerd', color: 'var(--success)', bg: 'var(--success-soft)', icon: CheckCircle2 },
  declined: { label: 'Afgewezen',    color: 'var(--danger)',  bg: 'var(--danger-soft)', icon: X },
  expired:  { label: 'Verlopen',     color: 'var(--warning)', bg: 'var(--warning-soft)', icon: Clock },
}

const QUOTE_STYLES = [
  { id: 'narratief',   label: 'Narratief',   icon: BookOpen,     desc: 'Uitgebreide toelichting per onderdeel', color: '#3b82f6' },
  { id: 'compact',     label: 'Compact',     icon: Layout,       desc: 'Kort, zakelijk en overzichtelijk',      color: '#8b5cf6' },
  { id: 'presentatie', label: 'Presentatie', icon: Presentation, desc: 'Met bedrijfsprofiel en verkooptekst',   color: '#06b6d4' },
]

const ESIGN_FIELDS = [
  { id: 'handtekening', label: 'Handtekening', icon: PenLine,      color: '#6366f1', w: 200, h: 64 },
  { id: 'naam',         label: 'Naam',         icon: Type,         color: '#3b82f6', w: 180, h: 36 },
  { id: 'datum',        label: 'Datum',        icon: CalendarDays, color: '#10b981', w: 130, h: 36 },
  { id: 'tekst',        label: 'Vrij tekst',   icon: FileText,     color: '#f59e0b', w: 200, h: 36 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Shared style helpers (theme-aware)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  card: { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, padding: 20 },
  inp: { background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, color: 'var(--text)', padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' },
  lbl: { display: 'block', color: 'var(--text-2)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  btn: (color, bg, border) => ({ display: 'flex', alignItems: 'center', gap: 6, background: bg || 'var(--surface-2)', border: `1px solid ${border || 'var(--border-2)'}`, borderRadius: 8, padding: '8px 14px', color: color || 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }),
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF print (supports narratief / compact / presentatie)
// ─────────────────────────────────────────────────────────────────────────────
const printQuotePDF = (quote, client, entity, companyTemplate) => {
  const totals = computeQuote(quote.items)
  const fmtE = n => '€\u00a0' + Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })
  const fmtD = iso => iso ? new Date(iso).toLocaleDateString('nl-NL') : '—'
  const style = quote.quoteStyle || 'compact'
  const accent = '#6366f1'

  const companySection = (style === 'presentatie' && companyTemplate?.about)
    ? `<div style="background:#f0f4ff;border-left:4px solid ${accent};border-radius:0 8px 8px 0;padding:18px 22px;margin-bottom:28px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;font-weight:600;margin-bottom:10px">Over ons</div>
        ${companyTemplate.about ? `<p style="margin:0 0 10px;color:#334155;font-size:13px;line-height:1.8">${companyTemplate.about}</p>` : ''}
        ${companyTemplate.services ? `<p style="margin:0 0 8px;color:#475569;font-size:12px"><strong>Onze diensten:</strong> ${companyTemplate.services}</p>` : ''}
        ${companyTemplate.approach ? `<p style="margin:0 0 8px;color:#475569;font-size:12px"><strong>Onze aanpak:</strong> ${companyTemplate.approach}</p>` : ''}
        ${companyTemplate.videoUrl ? `<p style="margin:8px 0 0;font-size:11px;color:#6366f1">Video presentatie: <a href="${companyTemplate.videoUrl}" style="color:#6366f1">${companyTemplate.videoUrl}</a></p>` : ''}
       </div>` : ''

  const introSection = quote.intro
    ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;color:#475569;font-size:13px;line-height:1.8">${quote.intro}</div>` : ''

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offerte ${quote.number}</title>
  <style>
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;padding:40px;max-width:760px;margin:0 auto;font-size:13px}
    .lbl{font-size:10px;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;font-weight:600;margin-bottom:3px}
    table{width:100%;border-collapse:collapse;margin:24px 0}
    th{text-align:left;padding:8px 12px;background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;border-bottom:2px solid #e2e8f0}
    td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top}
    .num{font-family:monospace;text-align:right}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(99,102,241,0.1);color:${accent}}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px}
    @page{size:A4;margin:10mm}
  </style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
    <div>
      ${entity?.logo ? `<img src="${entity.logo}" style="height:40px;margin-bottom:8px;display:block" />` : ''}
      <div style="font-size:20px;font-weight:800;color:${accent};margin-bottom:4px">${entity?.name || 'DHS Finance'}</div>
      ${entity?.address ? `<div style="color:#64748b;font-size:12px">${entity.address}</div>` : ''}
      ${entity?.kvk ? `<div style="color:#94a3b8;font-size:11px">KvK: ${entity.kvk}</div>` : ''}
    </div>
    <div style="text-align:right">
      <span class="badge">Offerte</span>
      <div style="font-size:22px;font-weight:700;margin-top:6px">${quote.number}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #e2e8f0">
    <div><div class="lbl">Klant</div><div style="font-weight:600">${client?.name || '—'}</div>${client?.address ? `<div style="color:#64748b;font-size:12px">${client.address}</div>` : ''}</div>
    <div><div class="lbl">Datum</div><div>${fmtD(quote.date)}</div></div>
    <div><div class="lbl">Geldig tot</div><div>${fmtD(quote.validUntil)}</div></div>
  </div>
  ${companySection}
  ${introSection}
  <table>
    <thead><tr><th>Omschrijving</th><th style="text-align:center">Aantal</th><th style="text-align:right">Prijs</th><th style="text-align:center">BTW</th><th style="text-align:right">Totaal</th></tr></thead>
    <tbody>${quote.items.map(it => {
      const net = Number(it.quantity || 0) * Number(it.price || 0)
      const btw = net * (Number(it.btwRate || 0) / 100)
      return `<tr><td style="${style === 'narratief' ? 'white-space:pre-wrap;' : ''}">${it.description || ''}</td><td style="text-align:center">${it.quantity}</td><td class="num">${fmtE(it.price)}</td><td style="text-align:center">${it.btwRate}%</td><td class="num">${fmtE(net + btw)}</td></tr>`
    }).join('')}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end">
    <div style="min-width:280px">
      <div style="display:flex;justify-content:space-between;padding:6px 0;color:#64748b"><span>Subtotaal</span><span style="font-family:monospace">${fmtE(totals.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;color:#64748b"><span>BTW</span><span style="font-family:monospace">${fmtE(totals.btwTotal)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:700;font-size:16px;border-top:2px solid #e2e8f0;color:${accent};margin-top:4px"><span>Totaal</span><span style="font-family:monospace">${fmtE(totals.total)}</span></div>
    </div>
  </div>
  ${quote.notes ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;color:#475569;margin-top:16px"><strong style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;display:block;margin-bottom:4px">Notities</strong>${quote.notes}</div>` : ''}
  ${quote.signatureData ? `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-top:24px;background:#f8fafc"><div class="lbl" style="margin-bottom:8px">Digitale handtekening</div><img src="${quote.signatureData}" style="max-height:60px;display:block;margin-bottom:6px" /><div style="font-size:12px;color:#64748b">Ondertekend door ${quote.signerName || 'klant'} op ${fmtD(quote.signedAt)}</div></div>` : ''}
  <div class="footer">Opgemaakt door ${entity?.name || 'DHS Finance'} · ${new Date().toLocaleDateString('nl-NL')}</div>
  </body></html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) { alert('Pop-up geblokkeerd. Sta pop-ups toe voor deze pagina.'); return }
  w.document.write(html); w.document.close()
  w.onload = () => { w.focus(); w.print() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature pad
// ─────────────────────────────────────────────────────────────────────────────
const SignaturePad = ({ onSave, onCancel }) => {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [empty, setEmpty] = useState(true)

  const getPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return { x: src.clientX - r.left, y: src.clientY - r.top }
  }
  const start = e => { e.preventDefault(); const c = canvasRef.current, ctx = c.getContext('2d'), p = getPos(e, c); ctx.beginPath(); ctx.moveTo(p.x, p.y); setDrawing(true); setEmpty(false) }
  const move = e => { e.preventDefault(); if (!drawing) return; const c = canvasRef.current, ctx = c.getContext('2d'), p = getPos(e, c); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineTo(p.x, p.y); ctx.stroke() }
  const end = () => setDrawing(false)
  const clear = () => { canvasRef.current.getContext('2d').clearRect(0, 0, 480, 130); setEmpty(true) }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Pen size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Zet hier je handtekening</span>
      </div>
      <canvas
        ref={canvasRef} width={480} height={130}
        style={{ background: '#fff', borderRadius: 8, border: '2px solid #e2e8f0', cursor: 'crosshair', touchAction: 'none', display: 'block', width: '100%', maxWidth: 480, height: 130 }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={clear} style={C.btn()}>Wissen</button>
        <button onClick={() => onSave(canvasRef.current.toDataURL())} disabled={empty}
          style={{ ...C.btn('#fff', 'var(--accent)', 'transparent'), opacity: empty ? 0.4 : 1, cursor: empty ? 'not-allowed' : 'pointer' }}>
          <Check size={12} /> Bevestigen
        </button>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>Annuleren</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = STATUSES[status] || STATUSES.draft
  const Icon = s.icon
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <Icon size={10} /> {s.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Company template modal
// ─────────────────────────────────────────────────────────────────────────────
const CompanyTemplateModal = ({ template, onSave, onClose }) => {
  const [form, setForm] = useState(template || { about: '', services: '', approach: '', videoUrl: '', websiteUrl: '', attachToPresentatie: true })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Bedrijfsprofiel</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>Automatisch toevoegen aan offertes (Presentatie stijl)</p>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {[
          { key: 'about', label: 'Over ons', placeholder: 'Wie zijn jullie, wat doen jullie, wat maakt jullie uniek…', rows: 4 },
          { key: 'services', label: 'Onze diensten', placeholder: 'Welke diensten of producten bieden jullie aan?', rows: 3 },
          { key: 'approach', label: 'Onze aanpak', placeholder: 'Hoe werken jullie? Wat is jullie werkwijze?', rows: 3 },
        ].map(({ key, label, placeholder, rows }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label style={C.lbl}>{label}</label>
            <textarea style={{ ...C.inp, minHeight: rows * 24, resize: 'vertical', lineHeight: 1.6 }}
              value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={C.lbl}><Film size={11} style={{ display: 'inline', marginRight: 4 }} />Video URL</label>
            <input style={C.inp} value={form.videoUrl} onChange={e => set('videoUrl', e.target.value)} placeholder="https://youtube.com/watch?v=…" />
          </div>
          <div>
            <label style={C.lbl}><Globe size={11} style={{ display: 'inline', marginRight: 4 }} />Website</label>
            <input style={C.inp} value={form.websiteUrl} onChange={e => set('websiteUrl', e.target.value)} placeholder="https://uwbedrijf.nl" />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 20, fontSize: 13, color: 'var(--text)' }}>
          <input type="checkbox" checked={form.attachToPresentatie} onChange={e => set('attachToPresentatie', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#6366f1' }} />
          Automatisch toevoegen bij "Presentatie" stijl
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onSave(form)}
            style={{ flex: 1, background: '#6366f1', border: 'none', borderRadius: 8, padding: '10px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Opslaan
          </button>
          <button onClick={onClose} style={{ ...C.btn(), padding: '10px 18px' }}>Annuleren</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI assistant panel
// ─────────────────────────────────────────────────────────────────────────────
const AIAssistantPanel = ({ settings, quoteStyle, onApply, onClose }) => {
  const [text, setText] = useState('')
  const [style, setStyle] = useState(quoteStyle || 'compact')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const STYLE_PROMPTS = {
    narratief: 'Write detailed, explanatory Dutch descriptions for each service item. Add an "intro" field with a 2-3 sentence professional introduction. Use flowing, consultancy-style language.',
    compact: 'Write brief, concise Dutch descriptions. 1 line per item maximum. Minimal notes. Professional and direct.',
    presentatie: 'Write persuasive Dutch sales descriptions for each item. Add a compelling "intro" that emphasizes value and ROI. Use marketing language.',
  }

  const handleGenerate = async () => {
    if (!text.trim()) return
    setLoading(true); setError('')
    try {
      const system = `You extract structured quote (offerte) data from Dutch business text.
Return ONLY valid JSON (no markdown, no explanation):
{
  "intro": "optional intro paragraph (only for narratief/presentatie styles)",
  "items": [{ "description": "...", "quantity": 1, "price": 0, "btwRate": 21 }],
  "notes": "optional additional notes"
}
Style instruction: ${STYLE_PROMPTS[style]}
Prices are in EUR (numbers only). BTW rates: 0, 9, or 21%. Estimate reasonable prices if not specified.`
      const raw = await callAI(settings?.apiKey, system, `Extract quote items from:\n\n${text}`)
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Geen geldig antwoord ontvangen.')
      const result = JSON.parse(jsonMatch[0])
      onApply(result, style)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', marginTop: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>AI Offerte-assistent</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Plak tekst en kies een stijl</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Style picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={C.lbl}>Stijl</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {QUOTE_STYLES.map(s => (
              <button key={s.id} onClick={() => setStyle(s.id)}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${style === s.id ? s.color : 'var(--border-2)'}`, background: style === s.id ? `${s.color}18` : 'var(--surface-2)', color: style === s.id ? s.color : 'var(--text-2)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'center', lineHeight: 1.4, transition: 'all 0.15s' }}>
                <s.icon size={16} style={{ display: 'block', margin: '0 auto 4px' }} />
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
            {QUOTE_STYLES.find(s => s.id === style)?.desc}
          </div>
        </div>

        {/* Text input */}
        <div style={{ marginBottom: 16 }}>
          <label style={C.lbl}>Beschrijving / ruwe tekst</label>
          <textarea
            style={{ ...C.inp, minHeight: 160, resize: 'vertical', lineHeight: 1.6 }}
            value={text} onChange={e => setText(e.target.value)}
            placeholder="Plak hier een e-mail, notitie of omschrijving van wat je wilt offreren…&#10;&#10;Bijv: 'Website redesign voor 3 pagina's, inclusief SEO-optimalisatie en maandelijkse hosting. Looptijd 6 weken.'" />
        </div>

        {error && (
          <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 12px', color: 'var(--danger)', fontSize: 12, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        <button onClick={handleGenerate} disabled={loading || !text.trim()}
          style={{ width: '100%', background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, padding: '12px', color: loading ? 'var(--text-3)' : '#fff', fontSize: 14, fontWeight: 600, cursor: (loading || !text.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Genereren…</> : <><Sparkles size={16} /> Genereer offerte</>}
        </button>

        <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
          Resultaat wordt ingeladen in de offerte-editor. Je kunt alles nog aanpassen.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote editor
// ─────────────────────────────────────────────────────────────────────────────
const QuoteEditor = ({ quote, clients, settings, activeEntity, companyTemplate, onSave, onCancel }) => {
  const prefix = 'OFF-' + new Date().getFullYear() + '-'
  const [form, setForm] = useState(quote || {
    id: genId(), number: prefix + String(Date.now() % 10000).padStart(3, '0'),
    clientId: '', date: todayISO(), validUntil: addDays(todayISO(), 30),
    items: [{ id: genId(), description: '', quantity: 1, price: 0, btwRate: 21 }],
    notes: '', intro: '', quoteStyle: 'compact', status: 'draft', signToken: genToken(),
    entity: activeEntity?.id,
  })
  const [saving, setSaving] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const totals = computeQuote(form.items)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setItem = (idx, k, v) => setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it) }))
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { id: genId(), description: '', quantity: 1, price: 0, btwRate: 21 }] }))
  const removeItem = idx => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

  const applyAI = (result, style) => {
    setShowAI(false)
    setForm(f => ({
      ...f,
      quoteStyle: style,
      intro: result.intro || '',
      notes: result.notes || f.notes,
      items: result.items?.length
        ? result.items.map(it => ({ id: genId(), description: it.description || '', quantity: Number(it.quantity) || 1, price: Number(it.price) || 0, btwRate: Number(it.btwRate) || 21 }))
        : f.items,
    }))
  }

  const handleSave = async () => {
    if (!form.clientId) { alert('Selecteer een klant'); return }
    setSaving(true)
    // Auto-attach company template for presentatie style
    const toSave = form.quoteStyle === 'presentatie' && companyTemplate?.attachToPresentatie
      ? { ...form, _companyTemplate: companyTemplate }
      : form
    await onSave(toSave)
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {showAI && <AIAssistantPanel settings={settings} quoteStyle={form.quoteStyle} onApply={applyAI} onClose={() => setShowAI(false)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={onCancel} style={C.btn()}>← Terug</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            {quote ? `Offerte ${form.number}` : 'Nieuwe offerte'}
          </h2>
        </div>
        <button onClick={() => setShowAI(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 9, padding: '9px 16px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 12px rgba(99,102,241,0.3)' }}>
          <Sparkles size={14} /> AI-assistent
        </button>
      </div>

      {/* Style picker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {QUOTE_STYLES.map(s => (
          <button key={s.id} onClick={() => set('quoteStyle', s.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: `2px solid ${form.quoteStyle === s.id ? s.color : 'var(--border-2)'}`, background: form.quoteStyle === s.id ? `${s.color}15` : 'var(--surface)', color: form.quoteStyle === s.id ? s.color : 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
            <s.icon size={14} /> {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Left col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={C.card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={C.lbl}>Nummer</label>
                <input style={C.inp} value={form.number} onChange={e => set('number', e.target.value)} />
              </div>
              <div>
                <label style={C.lbl}>Klant *</label>
                <select style={C.inp} value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                  <option value="">Selecteer klant…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={C.lbl}>Datum</label>
                  <input style={C.inp} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
                </div>
                <div>
                  <label style={C.lbl}>Geldig tot</label>
                  <input style={C.inp} type="date" value={form.validUntil} onChange={e => set('validUntil', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div style={C.card}>
            {(form.quoteStyle === 'narratief' || form.quoteStyle === 'presentatie') && (
              <div style={{ marginBottom: 14 }}>
                <label style={C.lbl}>Introductie / aanhef</label>
                <textarea style={{ ...C.inp, minHeight: 80, resize: 'vertical', lineHeight: 1.6 }}
                  value={form.intro} onChange={e => set('intro', e.target.value)}
                  placeholder="Geachte…, Naar aanleiding van ons gesprek…" />
              </div>
            )}
            <label style={C.lbl}>Notities</label>
            <textarea style={{ ...C.inp, minHeight: 70, resize: 'vertical', lineHeight: 1.5 }}
              value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Betalingscondities, exclusies, opmerkingen…" />
          </div>
        </div>

        {/* Right col — totals */}
        <div style={{ ...C.card, alignSelf: 'start' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Samenvatting</h3>
          {[['Subtotaal (excl. BTW)', fmtEUR(totals.subtotal)], ['BTW', fmtEUR(totals.btwTotal)]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-3)' }}>{l}</span>
              <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontSize: 17, fontWeight: 700 }}>
            <span style={{ color: 'var(--text)' }}>Totaal</span>
            <span style={{ color: '#6366f1', fontFamily: 'monospace' }}>{fmtEUR(totals.total)}</span>
          </div>

          {form.quoteStyle === 'presentatie' && companyTemplate?.about && (
            <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', fontSize: 11, color: '#6366f1' }}>
              <Building2 size={11} style={{ display: 'inline', marginRight: 4 }} />
              Bedrijfsprofiel wordt meegestuurd in PDF
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div style={{ ...C.card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Regelitems</h3>
          <button onClick={addItem}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(99,102,241,0.1)', border: 'none', borderRadius: 6, padding: '5px 10px', color: '#6366f1', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            <Plus size={13} /> Regel
          </button>
        </div>
        <div className="hidden sm:grid" style={{ gridTemplateColumns: '3fr 70px 100px 70px 28px', gap: 8, marginBottom: 8, display: 'none' }}>
          {['Omschrijving', 'Aantal', 'Prijs (excl.)', 'BTW %', ''].map(h => (
            <div key={h} style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>
        {form.items.map((item, idx) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,3fr) 60px 90px 60px 28px', gap: 6, alignItems: 'start', marginBottom: 8 }}>
            {form.quoteStyle === 'narratief'
              ? <textarea style={{ ...C.inp, minHeight: 60, resize: 'vertical', lineHeight: 1.5 }} value={item.description} onChange={e => setItem(idx, 'description', e.target.value)} placeholder="Omschrijving (uitgebreid)" />
              : <input style={C.inp} value={item.description} onChange={e => setItem(idx, 'description', e.target.value)} placeholder="Omschrijving" />
            }
            <input style={C.inp} type="number" value={item.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)} />
            <input style={C.inp} type="number" step="0.01" value={item.price} onChange={e => setItem(idx, 'price', e.target.value)} />
            <select style={C.inp} value={item.btwRate} onChange={e => setItem(idx, 'btwRate', e.target.value)}>
              {[0, 9, 21].map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
            {form.items.length > 1
              ? <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, display: 'flex', alignItems: 'center' }}><Trash2 size={14} /></button>
              : <div />}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ flex: 1, background: '#6366f1', border: 'none', borderRadius: 9, padding: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Opslaan…</> : 'Offerte opslaan'}
        </button>
        <button onClick={onCancel} style={{ ...C.btn(), padding: '12px 18px', fontSize: 14 }}>Annuleren</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote detail
// ─────────────────────────────────────────────────────────────────────────────
const QuoteDetail = ({ quote, client, companyTemplate, activeEntity, onClose, onEdit, onDelete, onStatusChange, onConvertToInvoice }) => {
  const totals = computeQuote(quote.items)
  const shareUrl = `${window.location.origin}${window.location.pathname}?sign=${quote.signToken}`
  const [copied, setCopied] = useState(false)
  const qs = QUOTE_STYLES.find(s => s.id === quote.quoteStyle)

  const copyLink = () => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={onClose} style={C.btn()}>← Terug</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Offerte {quote.number}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <StatusBadge status={quote.status} />
            {qs && <span style={{ background: `${qs.color}15`, color: qs.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{qs.label}</span>}
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{client?.name} · {fmtDate(quote.date)}</span>
          </div>
        </div>
        <button onClick={() => printQuotePDF(quote, client, activeEntity, companyTemplate)} style={{ ...C.btn('var(--accent)', 'var(--accent-soft)', 'rgba(59,130,246,0.25)') }}>
          <Printer size={14} /> PDF
        </button>
        <button onClick={() => onEdit(quote)} style={C.btn()}>
          <Edit3 size={14} /> Bewerken
        </button>
        <button onClick={() => { if (confirm('Offerte verwijderen?')) onDelete(quote.id) }} style={C.btn('var(--danger)', 'var(--danger-soft)', 'rgba(239,68,68,0.2)')}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Share link */}
      <div style={{ ...C.card, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Link2 size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Deellink voor ondertekening</div>
          <code style={{ color: 'var(--text-3)', fontSize: 11, wordBreak: 'break-all' }}>{shareUrl}</code>
        </div>
        <button onClick={copyLink} style={C.btn(copied ? 'var(--success)' : '#6366f1', copied ? 'var(--success-soft)' : 'rgba(99,102,241,0.1)', copied ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.2)')}>
          {copied ? <><Check size={13} /> Gekopieerd</> : <><Copy size={13} /> Kopieer</>}
        </button>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[['Klant', client?.name || '—'], ['Datum', fmtDate(quote.date)], ['Geldig tot', fmtDate(quote.validUntil)], ['Totaal', fmtEUR(totals.total)]].map(([l, v]) => (
          <div key={l} style={{ ...C.card, padding: '12px 16px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{l}</div>
            <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500, fontFamily: l === 'Totaal' ? 'monospace' : 'inherit' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div style={{ ...C.card, marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Omschrijving', 'Aantal', 'Prijs', 'BTW', 'Totaal'].map(h => (
              <th key={h} style={{ textAlign: h === 'Omschrijving' ? 'left' : 'right', padding: '6px 10px', color: 'var(--text-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--border-2)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {quote.items.map((it, i) => {
              const net = Number(it.quantity) * Number(it.price)
              const btw = net * (Number(it.btwRate) / 100)
              return (
                <tr key={i}>
                  <td style={{ padding: 10, color: 'var(--text)', fontSize: 13, borderBottom: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>{it.description}</td>
                  <td style={{ padding: 10, textAlign: 'right', color: 'var(--text-2)', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{it.quantity}</td>
                  <td style={{ padding: 10, textAlign: 'right', color: 'var(--text-2)', fontSize: 13, borderBottom: '1px solid var(--border)', fontFamily: 'monospace' }}>{fmtEUR(it.price)}</td>
                  <td style={{ padding: 10, textAlign: 'right', color: 'var(--text-2)', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{it.btwRate}%</td>
                  <td style={{ padding: 10, textAlign: 'right', color: 'var(--text)', fontSize: 13, borderBottom: '1px solid var(--border)', fontFamily: 'monospace' }}>{fmtEUR(net + btw)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-2)' }}>
          <div style={{ minWidth: 200 }}>
            {[['Subtotaal', fmtEUR(totals.subtotal)], ['BTW', fmtEUR(totals.btwTotal)]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text-3)' }}>{l}</span>
                <span style={{ color: 'var(--text-2)', fontFamily: 'monospace' }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, fontSize: 16, fontWeight: 700, paddingTop: 8, borderTop: '1px solid var(--border-2)' }}>
              <span style={{ color: 'var(--text)' }}>Totaal</span>
              <span style={{ color: '#6366f1', fontFamily: 'monospace' }}>{fmtEUR(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {quote.status === 'draft' && <button onClick={() => onStatusChange(quote.id, 'sent')} style={C.btn('var(--accent)', 'var(--accent-soft)', 'rgba(59,130,246,0.25)')}><Send size={13} /> Markeer als verstuurd</button>}
        {quote.status === 'sent' && <>
          <button onClick={() => onStatusChange(quote.id, 'accepted')} style={C.btn('var(--success)', 'var(--success-soft)', 'rgba(16,185,129,0.25)')}><Check size={13} /> Geaccepteerd</button>
          <button onClick={() => onStatusChange(quote.id, 'declined')} style={C.btn('var(--danger)', 'var(--danger-soft)', 'rgba(239,68,68,0.2)')}><X size={13} /> Afgewezen</button>
          <button onClick={() => onStatusChange(quote.id, 'expired')} style={C.btn('var(--warning)', 'var(--warning-soft)', 'rgba(245,158,11,0.2)')}><Clock size={13} /> Verlopen</button>
        </>}
        {quote.status === 'accepted' && <button onClick={() => onConvertToInvoice(quote)} style={{ ...C.btn('#fff', '#6366f1', 'transparent'), boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}><ArrowRight size={13} /> Omzetten naar factuur</button>}
        {quote.status !== 'draft' && <button onClick={() => onStatusChange(quote.id, 'draft')} style={C.btn()}>Terug naar concept</button>}
      </div>

      {quote.notes && (
        <div style={{ ...C.card, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Notities</div>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>{quote.notes}</p>
        </div>
      )}

      {quote.signatureData && (
        <div style={{ background: 'var(--success-soft)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Pen size={11} style={{ color: 'var(--success)' }} /> Handtekening
          </div>
          <img src={quote.signatureData} alt="handtekening" style={{ maxHeight: 54, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', padding: 4, display: 'block', marginBottom: 6 }} />
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {quote.signerName && <><strong style={{ color: 'var(--text-2)' }}>{quote.signerName}</strong> · </>}
            {fmtDate(quote.signedAt)}
          </div>
        </div>
      )}

      {quote.history?.length > 0 && (
        <div style={{ ...C.card }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <History size={11} /> Geschiedenis
          </div>
          {[...quote.history].reverse().map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '5px 0', borderBottom: i < quote.history.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ color: 'var(--text-3)', fontFamily: 'monospace', fontSize: 11, minWidth: 80 }}>{h.at ? new Date(h.at).toLocaleDateString('nl-NL') : '—'}</span>
              <StatusBadge status={h.status} />
              {h.by && <span style={{ color: 'var(--text-3)', fontSize: 11 }}>door {h.by}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign view (quote, client-facing)
// ─────────────────────────────────────────────────────────────────────────────
const SignView = ({ token, quotes, clients, onSign }) => {
  const quote = quotes.find(q => q.signToken === token)
  const client = quote ? clients.find(c => c.id === quote.clientId) : null
  const [signerName, setSignerName] = useState('')
  const [step, setStep] = useState('review')

  if (!quote) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>
      <AlertCircle size={36} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--text-3)' }} />
      <p>Offerte niet gevonden of link ongeldig.</p>
    </div>
  )

  const totals = computeQuote(quote.items)
  const already = quote.status === 'accepted' || quote.status === 'declined'

  return (
    <div style={{ maxWidth: 660, margin: '0 auto', padding: '24px 16px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          <FileCheck2 size={20} color="#fff" />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>DHS Finance · Offertebeheer</div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 16, padding: '20px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <StatusBadge status={quote.status} />
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '12px 0 4px' }}>Offerte {quote.number}</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 13, margin: '0 0 20px' }}>{client?.name} · Geldig tot {fmtDate(quote.validUntil)}</p>

        {quote.intro && <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7, background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 8, marginBottom: 20 }}>{quote.intro}</p>}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr>{['Omschrijving', 'Prijs'].map(h => (
              <th key={h} style={{ textAlign: h === 'Omschrijving' ? 'left' : 'right', padding: '8px 0', color: 'var(--text-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border-2)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {quote.items.map((it, i) => {
              const total = Number(it.quantity) * Number(it.price) * (1 + Number(it.btwRate) / 100)
              return (
                <tr key={i}>
                  <td style={{ padding: '10px 0', color: 'var(--text)', fontSize: 13, borderBottom: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>
                    {it.description} <span style={{ color: 'var(--text-3)', fontSize: 11 }}>× {it.quantity}</span>
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--text)', fontSize: 13, borderBottom: '1px solid var(--border)', fontFamily: 'monospace' }}>{fmtEUR(total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginBottom: 24 }}>
          <span style={{ color: 'var(--text)' }}>Totaal (incl. BTW)</span>
          <span style={{ color: '#6366f1', fontFamily: 'monospace' }}>{fmtEUR(totals.total)}</span>
        </div>

        {quote.notes && <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20, background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>{quote.notes}</p>}

        {already ? (
          <div style={{ textAlign: 'center', padding: 20, background: quote.status === 'accepted' ? 'var(--success-soft)' : 'var(--danger-soft)', borderRadius: 10, border: `1px solid ${quote.status === 'accepted' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: quote.status === 'accepted' ? 'var(--success)' : 'var(--danger)', marginBottom: 4 }}>
              {quote.status === 'accepted' ? '✓ Geaccepteerd' : '✗ Afgewezen'}
            </div>
            {quote.signedAt && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>op {fmtDate(quote.signedAt)}{quote.signerName ? ` door ${quote.signerName}` : ''}</div>}
            {quote.signatureData && <img src={quote.signatureData} alt="handtekening" style={{ maxHeight: 50, marginTop: 12, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', padding: 4 }} />}
          </div>
        ) : step === 'sign' ? (
          <div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...C.lbl, marginBottom: 6 }}>Uw naam</label>
              <input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Voor- en achternaam"
                style={{ ...C.inp }} />
            </div>
            <SignaturePad onSave={sig => onSign(quote.id, 'accepted', sig, signerName)} onCancel={() => setStep('review')} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep('sign')}
              style={{ flex: 1, background: 'var(--success)', border: 'none', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Pen size={15} /> Accepteren &amp; ondertekenen
            </button>
            <button onClick={() => onSign(quote.id, 'declined', null, signerName)}
              style={{ flex: 1, background: 'var(--danger-soft)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: 'var(--danger)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <X size={15} /> Afwijzen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// E-Sign: document editor (upload + field placement)
// ─────────────────────────────────────────────────────────────────────────────
const ESignEditor = ({ doc, onSave, onCancel }) => {
  const [name, setName] = useState(doc?.name || '')
  const [fileData, setFileData] = useState(doc?.fileData || null)
  const [fileType, setFileType] = useState(doc?.fileType || null)
  const [fields, setFields] = useState(doc?.fields || [])
  const [selectedType, setSelectedType] = useState('handtekening')
  const [dragField, setDragField] = useState(null) // { id, startX, startY }
  const docRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleFile = e => {
    const f = e.target.files[0]; if (!f) return
    if (f.size > 5 * 1024 * 1024) { alert('Bestand mag maximaal 5 MB zijn voor opslag in de browser.'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      setFileData(ev.target.result)
      setFileType(f.type.startsWith('image/') ? 'image' : 'pdf')
      if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
    }
    reader.readAsDataURL(f)
  }

  const handleDocClick = e => {
    if (!docRef.current) return
    const rect = docRef.current.getBoundingClientRect()
    const scrollTop = docRef.current.scrollTop
    const scrollLeft = docRef.current.scrollLeft
    const x = ((e.clientX - rect.left + scrollLeft) / docRef.current.scrollWidth) * 100
    const y = ((e.clientY - rect.top + scrollTop) / docRef.current.scrollHeight) * 100
    const ft = ESIGN_FIELDS.find(f => f.id === selectedType)
    setFields(prev => [...prev, { id: genId(), type: selectedType, x, y, label: ft?.label || selectedType }])
  }

  const removeField = id => setFields(prev => prev.filter(f => f.id !== id))

  const handleSave = () => {
    if (!name.trim()) { alert('Geef het document een naam'); return }
    if (!fileData) { alert('Upload eerst een document'); return }
    onSave({ id: doc?.id || genId(), name, fileData, fileType, fields, signToken: doc?.signToken || genEsignToken(), status: doc?.status || 'draft', createdAt: doc?.createdAt || new Date().toISOString() })
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onCancel} style={C.btn()}>← Terug</button>
        <h2 style={{ margin: 0, flex: 1, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
          {doc ? `E-Sign: ${doc.name}` : 'Nieuw E-Sign document'}
        </h2>
        <button onClick={handleSave}
          style={{ background: '#10b981', border: 'none', borderRadius: 9, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Opslaan &amp; deellink genereren
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={C.lbl}>Naam document</label>
        <input style={{ ...C.inp, maxWidth: 400 }} value={name} onChange={e => setName(e.target.value)} placeholder="Bijv. Samenwerkingsovereenkomst 2025" />
      </div>

      {!fileData ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{ border: '2px dashed var(--border-2)', borderRadius: 14, padding: '48px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface)', transition: 'border-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Upload size={22} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Sleep een bestand hierheen of klik om te uploaden</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>PDF of afbeelding — max 5 MB</div>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFile} style={{ display: 'none' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>
          {/* Field type picker sidebar */}
          <div>
            <div style={{ ...C.card, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Veld toevoegen</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5 }}>Kies een type en klik op het document om een veld te plaatsen.</div>
              {ESIGN_FIELDS.map(ft => (
                <button key={ft.id} onClick={() => setSelectedType(ft.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 8, border: `2px solid ${selectedType === ft.id ? ft.color : 'var(--border)'}`, background: selectedType === ft.id ? `${ft.color}12` : 'transparent', color: selectedType === ft.id ? ft.color : 'var(--text-2)', fontSize: 12, fontWeight: selectedType === ft.id ? 700 : 500, cursor: 'pointer', marginBottom: 6, textAlign: 'left', transition: 'all 0.12s' }}>
                  <ft.icon size={14} /> {ft.label}
                </button>
              ))}
            </div>

            {fields.length > 0 && (
              <div style={C.card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Geplaatste velden</div>
                {fields.map((f, i) => {
                  const ft = ESIGN_FIELDS.find(t => t.id === f.type)
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ft?.color || '#888', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--text-2)' }}>{f.label}</span>
                      <button onClick={() => removeField(f.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={11} /></button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Document preview with click overlay */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ESIGN_FIELDS.find(f => f.id === selectedType)?.color }} />
              Klik op het document om een <strong>{ESIGN_FIELDS.find(f => f.id === selectedType)?.label}</strong>-veld te plaatsen
              <button onClick={() => { setFileData(null); setFields([]) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Ander bestand</button>
            </div>

            <div style={{ position: 'relative', cursor: 'crosshair', borderRadius: 10, overflow: 'auto', maxHeight: '72vh', border: '2px solid var(--border-2)' }}
              ref={docRef} onClick={handleDocClick}>
              {fileType === 'image'
                ? <img src={fileData} style={{ display: 'block', width: '100%', userSelect: 'none', pointerEvents: 'none' }} alt="document" />
                : <iframe src={fileData} style={{ display: 'block', width: '100%', height: 1100, border: 'none', pointerEvents: 'none' }} title="document preview" />
              }
              {/* Field overlays */}
              {fields.map(f => {
                const ft = ESIGN_FIELDS.find(t => t.id === f.type)
                return (
                  <div key={f.id}
                    style={{ position: 'absolute', left: `${f.x}%`, top: `${f.y}%`, transform: 'translate(-50%, -50%)', background: `${ft?.color}22`, border: `2px solid ${ft?.color || '#888'}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, color: ft?.color, fontWeight: 700, pointerEvents: 'none', whiteSpace: 'nowrap', backdropFilter: 'blur(2px)' }}>
                    <ft.icon size={11} style={{ display: 'inline', marginRight: 4 }} />{f.label}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// E-Sign: detail / share view
// ─────────────────────────────────────────────────────────────────────────────
const ESignDetail = ({ doc, onClose, onEdit, onDelete }) => {
  const shareUrl = `${window.location.origin}${window.location.pathname}?sign=${doc.signToken}`
  const [copied, setCopied] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const copyLink = () => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const emailSubject = encodeURIComponent(`${doc.name} — ter ondertekening`)
  const emailBody = encodeURIComponent(`Beste,\n\nGraag ontvangen wij uw handtekening voor het volgende document:\n\n${doc.name}\n\nKlik op de onderstaande link om het document te bekijken en te ondertekenen:\n\n${shareUrl}\n\nMet vriendelijke groet,\nDHS Finance`)
  const whatsappText = encodeURIComponent(`Hallo! Uw handtekening is gevraagd voor *${doc.name}*.\n\nKlik hier om te ondertekenen:\n${shareUrl}`)

  const statusMap = {
    draft:  { label: 'Concept',    color: 'var(--text-2)',  bg: 'var(--surface-3)' },
    sent:   { label: 'Verstuurd',  color: 'var(--accent)',  bg: 'var(--accent-soft)' },
    signed: { label: 'Ondertekend', color: 'var(--success)', bg: 'var(--success-soft)' },
  }
  const st = statusMap[doc.status] || statusMap.draft

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onClose} style={C.btn()}>← Terug</button>
        <h2 style={{ margin: 0, flex: 1, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{doc.name}</h2>
        <span style={{ background: st.bg, color: st.color, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{st.label}</span>
        <button onClick={() => onEdit(doc)} style={C.btn()}><Edit3 size={13} /> Bewerken</button>
        <button onClick={() => { if (confirm('Document verwijderen?')) onDelete(doc.id) }} style={C.btn('var(--danger)', 'var(--danger-soft)', 'rgba(239,68,68,0.2)')}><Trash2 size={13} /></button>
      </div>

      {/* Share link */}
      <div style={{ ...C.card, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <FileSignature size={16} style={{ color: '#10b981', flexShrink: 0 }} />
          <div style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deellink voor ondertekening</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <code style={{ flex: 1, color: 'var(--text-3)', fontSize: 11, wordBreak: 'break-all', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', display: 'block' }}>{shareUrl}</code>
          <button onClick={copyLink} style={C.btn(copied ? 'var(--success)' : '#10b981', copied ? 'var(--success-soft)' : 'rgba(16,185,129,0.1)', copied ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.25)')}>
            {copied ? <><Check size={13} /> Gekopieerd</> : <><Copy size={13} /> Kopieer</>}
          </button>
        </div>

        {/* Email share */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Verstuur per e-mail</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              placeholder="naam@email.com (optioneel)"
              style={{ ...C.inp, flex: 1 }}
            />
            <a
              href={`mailto:${emailTo}?subject=${emailSubject}&body=${emailBody}`}
              style={{ ...C.btn('var(--text)', 'var(--surface-2)', 'var(--border-2)'), textDecoration: 'none' }}
            >
              <Mail size={13} /> Open e-mail
            </a>
          </div>
        </div>

        {/* WhatsApp share */}
        <a
          href={`https://wa.me/?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...C.btn('#fff', '#25D366', '#1db954'), textDecoration: 'none', display: 'inline-flex' }}
        >
          <MessageCircle size={13} /> Deel via WhatsApp
        </a>
      </div>

      {/* Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[['Aangemaakt', fmtDate(doc.createdAt)], ['Velden', `${doc.fields?.length || 0} veld${doc.fields?.length !== 1 ? 'en' : ''}`], ['Type', doc.fileType === 'image' ? 'Afbeelding' : 'PDF']].map(([l, v]) => (
          <div key={l} style={{ ...C.card, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{l}</div>
            <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Signed info */}
      {doc.status === 'signed' && (
        <div style={{ background: 'var(--success-soft)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Ondertekend</div>
          {doc.signedFields && Object.entries(doc.signedFields).map(([fid, val]) => {
            const field = doc.fields?.find(f => f.id === fid)
            return (
              <div key={fid} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                <strong style={{ color: 'var(--text)' }}>{field?.label || fid}:</strong> {val}
              </div>
            )
          })}
          {doc.signatureData && <img src={doc.signatureData} alt="sig" style={{ maxHeight: 50, marginTop: 8, background: '#fff', borderRadius: 6, padding: 4, border: '1px solid #e2e8f0' }} />}
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>op {fmtDate(doc.signedAt)}</div>
        </div>
      )}

      {/* Document preview */}
      <div style={{ ...C.card, padding: 0, overflow: 'hidden' }}>
        {doc.fileType === 'image'
          ? <img src={doc.fileData} style={{ display: 'block', width: '100%', borderRadius: 12 }} alt="document" />
          : <iframe src={doc.fileData} style={{ display: 'block', width: '100%', height: 600, border: 'none' }} title="document" />
        }
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// E-Sign: signer view (client-facing, via ?sign=esign_TOKEN)
// ─────────────────────────────────────────────────────────────────────────────
const ESignSignView = ({ token, esignDocs, onSigned }) => {
  const doc = esignDocs.find(d => d.signToken === token)
  const [fieldValues, setFieldValues] = useState({})
  const [showSigPad, setShowSigPad] = useState(false)
  const [sigData, setSigData] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  if (!doc) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>
      <AlertCircle size={36} style={{ margin: '0 auto 12px', display: 'block' }} />
      <p>Document niet gevonden of link ongeldig.</p>
    </div>
  )

  const sigFields = doc.fields?.filter(f => f.type === 'handtekening') || []
  const otherFields = doc.fields?.filter(f => f.type !== 'handtekening') || []
  const allFilled = otherFields.every(f => fieldValues[f.id]?.trim()) && (sigFields.length === 0 || sigData)

  const handleSubmit = () => {
    if (!allFilled) return
    onSigned(doc.id, { ...fieldValues, ...(sigData ? { [sigFields[0]?.id || 'sig']: sigData } : {}) }, sigData)
    setSubmitted(true)
  }

  if (doc.status === 'signed' || submitted) return (
    <div style={{ maxWidth: 540, margin: '60px auto', padding: 20, textAlign: 'center' }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <CheckCircle2 size={28} style={{ color: 'var(--success)' }} />
      </div>
      <h2 style={{ color: 'var(--text)', margin: '0 0 8px' }}>Document ondertekend</h2>
      <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Bedankt! Het document is succesvol ondertekend.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 660, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          <FileSignature size={20} color="#fff" />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>DHS Finance · E-Sign</div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 16, padding: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{doc.name}</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 12, margin: '0 0 24px' }}>Bekijk het document en vul de gevraagde velden in.</p>

        {/* Document */}
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-2)', marginBottom: 24 }}>
          {doc.fileType === 'image'
            ? <img src={doc.fileData} style={{ display: 'block', width: '100%' }} alt="document" />
            : <iframe src={doc.fileData} style={{ display: 'block', width: '100%', height: 'clamp(340px, 65vh, 700px)', border: 'none' }} title="document" />
          }
        </div>

        {/* Fill fields */}
        {otherFields.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Vul de velden in</div>
            {otherFields.map(f => {
              const ft = ESIGN_FIELDS.find(t => t.id === f.type)
              return (
                <div key={f.id} style={{ marginBottom: 14 }}>
                  <label style={{ ...C.lbl, color: ft?.color }}><ft.icon size={11} style={{ display: 'inline', marginRight: 4 }} />{f.label}</label>
                  <input
                    style={C.inp}
                    type={f.type === 'datum' ? 'date' : 'text'}
                    value={fieldValues[f.id] || ''}
                    onChange={e => setFieldValues(v => ({ ...v, [f.id]: e.target.value }))}
                    placeholder={f.type === 'naam' ? 'Uw volledige naam' : f.label}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Signature */}
        {sigFields.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Handtekening</div>
            {sigData
              ? <div style={{ textAlign: 'center' }}>
                  <img src={sigData} alt="handtekening" style={{ maxHeight: 80, background: '#fff', borderRadius: 8, padding: 8, border: '1px solid #e2e8f0', display: 'block', margin: '0 auto 10px' }} />
                  <button onClick={() => { setSigData(null); setShowSigPad(false) }} style={{ ...C.btn(), fontSize: 12 }}>Opnieuw</button>
                </div>
              : showSigPad
                ? <SignaturePad onSave={d => { setSigData(d); setShowSigPad(false) }} onCancel={() => setShowSigPad(false)} />
                : <button onClick={() => setShowSigPad(true)}
                    style={{ width: '100%', border: '2px dashed var(--border-2)', borderRadius: 10, padding: 20, background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <PenLine size={16} /> Klik om te ondertekenen
                  </button>
            }
          </div>
        )}

        <button onClick={handleSubmit} disabled={!allFilled}
          style={{ width: '100%', background: allFilled ? '#10b981' : 'var(--surface-2)', border: 'none', borderRadius: 10, padding: 13, color: allFilled ? '#fff' : 'var(--text-3)', fontSize: 14, fontWeight: 700, cursor: allFilled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Check size={16} /> Document ondertekenen &amp; bevestigen
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty states
// ─────────────────────────────────────────────────────────────────────────────
const QuotesEmpty = ({ onNew }) => (
  <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14 }}>
    <FileCheck2 size={40} style={{ margin: '0 auto 16px', display: 'block', color: 'var(--text-3)' }} />
    <h3 style={{ color: 'var(--text)', margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Nog geen offertes</h3>
    <p style={{ color: 'var(--text-3)', fontSize: 13, margin: '0 0 20px' }}>Maak je eerste offerte aan en stuur hem op naar je klant.</p>
    <button onClick={onNew}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#6366f1', border: 'none', borderRadius: 8, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
      <Plus size={15} /> Offerte aanmaken
    </button>
  </div>
)

const ESignEmpty = ({ onNew }) => (
  <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14 }}>
    <FileSignature size={40} style={{ margin: '0 auto 16px', display: 'block', color: 'var(--text-3)' }} />
    <h3 style={{ color: 'var(--text)', margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Nog geen E-Sign documenten</h3>
    <p style={{ color: 'var(--text-3)', fontSize: 13, margin: '0 0 20px' }}>Upload een PDF of afbeelding, markeer de velden en stuur de deellink.</p>
    <button onClick={onNew}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#10b981', border: 'none', borderRadius: 8, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
      <Upload size={15} /> Document uploaden
    </button>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Main QuotesView
// ─────────────────────────────────────────────────────────────────────────────
export default function QuotesView({ quotes, setQuotes, clients, settings, activeEntity, onConvertToInvoice, signToken }) {
  const [tab, setTab] = useState('quotes') // 'quotes' | 'esign'
  const [view, setView] = useState('list')  // list | new | edit | detail
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showTemplate, setShowTemplate] = useState(false)
  const [companyTemplate, setCompanyTemplate] = useLocalStorage('dhs_company_template', { about: '', services: '', approach: '', videoUrl: '', websiteUrl: '', attachToPresentatie: true })
  const [esignDocs, setEsignDocs] = useLocalStorage('dhs_esign_docs', [])
  const [esignView, setEsignView] = useState('list') // list | new | edit | detail
  const [esignSelected, setEsignSelected] = useState(null)

  // Detect E-Sign token (prefixed with 'esign_')
  const isEsignToken = signToken?.startsWith('esign_')

  // E-Sign sign view
  if (isEsignToken) {
    return (
      <ESignSignView
        token={signToken}
        esignDocs={esignDocs}
        onSigned={(id, fields, sigData) => {
          setEsignDocs(prev => prev.map(d => d.id === id ? { ...d, status: 'signed', signedFields: fields, signatureData: sigData, signedAt: new Date().toISOString() } : d))
        }}
      />
    )
  }

  // Quote sign view
  if (signToken && !isEsignToken) {
    return (
      <SignView
        token={signToken}
        quotes={quotes}
        clients={clients}
        onSign={(id, status, sig, name) => {
          const signedAt = new Date().toISOString()
          setQuotes(quotes.map(q => q.id === id ? { ...q, status, signedAt, ...(sig ? { signatureData: sig, signerName: name } : {}), history: [...(q.history || []), { status, at: signedAt, by: name }] } : q))
        }}
      />
    )
  }

  // Hooks must be called before any early returns
  const filtered = useMemo(() => {
    let q = [...quotes].sort((a, b) => new Date(b.date) - new Date(a.date))
    if (filter !== 'all') q = q.filter(x => x.status === filter)
    if (search) {
      const s = search.toLowerCase()
      const cm = Object.fromEntries(clients.map(c => [c.id, c.name?.toLowerCase()]))
      q = q.filter(x => x.number?.toLowerCase().includes(s) || cm[x.clientId]?.includes(s))
    }
    return q
  }, [quotes, filter, search, clients])
  const counts = Object.fromEntries(Object.keys(STATUSES).map(k => [k, quotes.filter(q => q.status === k).length]))

  // Quote CRUD
  const saveQuote = async q => {
    const updated = quotes.find(x => x.id === q.id)
      ? quotes.map(x => x.id === q.id ? q : x)
      : [q, ...quotes]
    await setQuotes(updated)
    setView('list')
  }
  const deleteQuote = async id => { await setQuotes(quotes.filter(q => q.id !== id)); setView('list') }
  const changeStatus = async (id, status, sig = null, signerName = null) => {
    const signedAt = new Date().toISOString()
    await setQuotes(quotes.map(q => q.id === id ? {
      ...q, status, signedAt: (status === 'accepted' || status === 'declined') ? signedAt : q.signedAt,
      ...(sig ? { signatureData: sig, signerName } : {}),
      history: [...(q.history || []), { status, at: signedAt, ...(signerName ? { by: signerName } : {}) }],
    } : q))
    if (selected?.id === id) setSelected(s => ({ ...s, status }))
  }
  const convertToInvoice = quote => {
    const inv = {
      id: `inv_${Date.now().toString(36)}`, number: quote.number.replace('OFF-', 'FACT-'),
      clientId: quote.clientId, issueDate: todayISO(),
      dueDate: addDays(todayISO(), settings?.invoice?.paymentTerms || 14),
      items: quote.items, notes: quote.notes, status: 'draft',
      entityId: activeEntity?.id, fromQuoteId: quote.id,
    }
    changeStatus(quote.id, 'converted')
    onConvertToInvoice?.(inv)
  }

  // E-Sign CRUD
  const saveEsignDoc = doc => {
    setEsignDocs(prev => {
      const exists = prev.find(d => d.id === doc.id)
      return exists ? prev.map(d => d.id === doc.id ? doc : d) : [doc, ...prev]
    })
    setEsignView('list')
  }
  const deleteEsignDoc = id => { setEsignDocs(prev => prev.filter(d => d.id !== id)); setEsignView('list') }

  // Quote views
  if (view === 'new') return <QuoteEditor clients={clients} settings={settings} activeEntity={activeEntity} companyTemplate={companyTemplate} onSave={saveQuote} onCancel={() => setView('list')} />
  if (view === 'edit' && selected) return <QuoteEditor quote={selected} clients={clients} settings={settings} activeEntity={activeEntity} companyTemplate={companyTemplate} onSave={saveQuote} onCancel={() => setView('list')} />
  if (view === 'detail' && selected) return (
    <QuoteDetail
      quote={selected} client={clients.find(c => c.id === selected.clientId)} companyTemplate={companyTemplate}
      activeEntity={activeEntity}
      onClose={() => setView('list')} onEdit={q => { setSelected(q); setView('edit') }}
      onDelete={deleteQuote} onStatusChange={changeStatus} onConvertToInvoice={convertToInvoice}
    />
  )

  // E-Sign views
  if (esignView === 'new') return <ESignEditor onSave={saveEsignDoc} onCancel={() => setEsignView('list')} />
  if (esignView === 'edit' && esignSelected) return <ESignEditor doc={esignSelected} onSave={saveEsignDoc} onCancel={() => setEsignView('list')} />
  if (esignView === 'detail' && esignSelected) return (
    <ESignDetail
      doc={esignSelected}
      onClose={() => setEsignView('list')}
      onEdit={d => { setEsignSelected(d); setEsignView('edit') }}
      onDelete={deleteEsignDoc}
    />
  )

  // List view

  return (
    <div>
      {showTemplate && <CompanyTemplateModal template={companyTemplate} onSave={t => { setCompanyTemplate(t); setShowTemplate(false) }} onClose={() => setShowTemplate(false)} />}

      {/* Top-level tabs: Offertes / E-Sign */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { id: 'quotes', label: 'Offertes', icon: FileCheck2 },
          { id: 'esign', label: 'E-Sign documenten', icon: FileSignature },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: '8px 8px 0 0', border: 'none', background: tab === t.id ? 'var(--surface)' : 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--text-3)', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent', transition: 'all 0.15s', marginBottom: -1 }}>
            <t.icon size={15} /> {t.label}
            {t.id === 'quotes' && quotes.length > 0 && <span style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{quotes.length}</span>}
            {t.id === 'esign' && esignDocs.length > 0 && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{esignDocs.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Offertes tab ── */}
      {tab === 'quotes' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Offertes</h1>
              <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>{quotes.length} offerte{quotes.length !== 1 ? 's' : ''} totaal</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowTemplate(true)}
                style={{ ...C.btn(), gap: 7 }}>
                <Building2 size={14} /> Bedrijfsprofiel
              </button>
              <button onClick={() => setView('new')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#6366f1', border: 'none', borderRadius: 8, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={15} /> Nieuwe offerte
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            {[{ key: 'all', label: `Alles (${quotes.length})` }, ...Object.entries(STATUSES).map(([k, s]) => ({ key: k, label: `${s.label} (${counts[k] || 0})` }))].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: filter === key ? 700 : 500, cursor: 'pointer', background: filter === key ? '#6366f1' : 'var(--surface-2)', color: filter === key ? '#fff' : 'var(--text-2)', transition: 'all 0.12s' }}>
                {label}
              </button>
            ))}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op nummer of klant…"
              style={{ ...C.inp, marginLeft: 'auto', width: 'auto', minWidth: 180 }} />
          </div>

          {/* List */}
          {filtered.length === 0
            ? quotes.length === 0
              ? <QuotesEmpty onNew={() => setView('new')} />
              : <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12 }}>Geen offertes gevonden</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(q => {
                  const client = clients.find(c => c.id === q.clientId)
                  const totals = computeQuote(q.items)
                  const isExpired = q.status === 'sent' && q.validUntil && new Date(q.validUntil) < new Date()
                  const effStatus = isExpired ? 'expired' : q.status
                  const qs = QUOTE_STYLES.find(s => s.id === q.quoteStyle)
                  return (
                    <div key={q.id}
                      onClick={() => { setSelected(q); setView('detail') }}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{q.number}</span>
                          <StatusBadge status={effStatus} />
                          {qs && <span style={{ background: `${qs.color}15`, color: qs.color, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8 }}>{qs.label}</span>}
                        </div>
                        <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
                          {client?.name || '—'} · {fmtDate(q.date)} · geldig t/m {fmtDate(q.validUntil)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fmtEUR(totals.total)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{q.items.length} regel{q.items.length !== 1 ? 's' : ''}</div>
                      </div>
                      <ChevronRight size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                    </div>
                  )
                })}
              </div>
            )}
        </div>
      )}

      {/* ── E-Sign tab ── */}
      {tab === 'esign' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>E-Sign documenten</h1>
              <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>Upload PDF of afbeelding, markeer velden en verstuur de deellink</p>
            </div>
            <button onClick={() => setEsignView('new')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#10b981', border: 'none', borderRadius: 8, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Upload size={15} /> Document uploaden
            </button>
          </div>

          {esignDocs.length === 0
            ? <ESignEmpty onNew={() => setEsignView('new')} />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {esignDocs.map(doc => {
                  const stMap = { draft: { label: 'Concept', color: 'var(--text-2)' }, sent: { label: 'Verstuurd', color: 'var(--accent)' }, signed: { label: 'Ondertekend', color: 'var(--success)' } }
                  const st = stMap[doc.status] || stMap.draft
                  return (
                    <div key={doc.id}
                      onClick={() => { setEsignSelected(doc); setEsignView('detail') }}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 9, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileSignature size={18} style={{ color: '#10b981' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, marginBottom: 3 }}>{doc.name}</div>
                        <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
                          {doc.fileType === 'image' ? 'Afbeelding' : 'PDF'} · {doc.fields?.length || 0} veld{doc.fields?.length !== 1 ? 'en' : ''} · {fmtDate(doc.createdAt)}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: 'var(--surface-2)', padding: '3px 10px', borderRadius: 20 }}>{st.label}</span>
                      <ChevronRight size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                    </div>
                  )
                })}
              </div>
            )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
