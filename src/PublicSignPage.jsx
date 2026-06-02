import { useState, useRef } from 'react'
import { FileSignature, CheckCircle2, Check, AlertCircle, PenLine, Pen } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────
const readLocal = (key) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null } catch { return null }
}
const writeLocal = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

const ESIGN_FIELDS = [
  { id: 'handtekening', label: 'Handtekening', color: '#6366f1' },
  { id: 'naam',         label: 'Naam',         color: '#3b82f6' },
  { id: 'datum',        label: 'Datum',        color: '#10b981' },
  { id: 'tekst',        label: 'Vrij tekst',   color: '#f59e0b' },
]

// ── Signature pad ─────────────────────────────────────────────────────────────
const SignaturePad = ({ onSave, onCancel }) => {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [empty, setEmpty] = useState(true)

  const getPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - r.left) * (canvas.width / r.width),
      y: (src.clientY - r.top) * (canvas.height / r.height),
    }
  }
  const start = e => {
    e.preventDefault()
    const c = canvasRef.current, ctx = c.getContext('2d'), p = getPos(e, c)
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
    setDrawing(true); setEmpty(false)
  }
  const move = e => {
    e.preventDefault()
    if (!drawing) return
    const c = canvasRef.current, ctx = c.getContext('2d'), p = getPos(e, c)
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.lineTo(p.x, p.y); ctx.stroke()
  }
  const end = () => setDrawing(false)
  const clear = () => { canvasRef.current.getContext('2d').clearRect(0, 0, 480, 140); setEmpty(true) }

  return (
    <div>
      <canvas
        ref={canvasRef} width={480} height={140}
        style={{ background: '#fff', borderRadius: 10, border: '2px solid #e2e8f0', cursor: 'crosshair', touchAction: 'none', display: 'block', width: '100%' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={clear} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#64748b' }}>
          Wissen
        </button>
        <button onClick={() => onSave(canvasRef.current.toDataURL())} disabled={empty}
          style={{ background: empty ? '#f1f5f9' : '#6366f1', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: empty ? '#94a3b8' : '#fff', cursor: empty ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={14} /> Bevestigen
        </button>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
          Annuleren
        </button>
      </div>
    </div>
  )
}

// ── Not found ─────────────────────────────────────────────────────────────────
const NotFound = ({ msg }) => (
  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
    <AlertCircle size={44} color="#94a3b8" style={{ margin: '0 auto 16px', display: 'block' }} />
    <h2 style={{ color: '#334155', margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Document niet gevonden</h2>
    <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{msg || 'De link is ongeldig of het document bestaat niet meer.'}</p>
  </div>
)

// ── Success ───────────────────────────────────────────────────────────────────
const Success = ({ title, sub, showAppLink }) => (
  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
    <div style={{ width: 68, height: 68, borderRadius: 20, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
      <CheckCircle2 size={34} color="#10b981" />
    </div>
    <h2 style={{ color: '#0f172a', margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>{title}</h2>
    <p style={{ color: '#64748b', fontSize: 14, margin: showAppLink ? '0 0 24px' : 0 }}>{sub}</p>
    {showAppLink && (
      <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0f172a', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600 }}>
        ← Terug naar DHS Finance
      </a>
    )}
  </div>
)

// ── E-Sign public view ────────────────────────────────────────────────────────
const EsignView = ({ token }) => {
  const [esignDocs, setEsignDocs] = useState(() => readLocal('dhs_esign_docs') || [])
  const [fieldValues, setFieldValues] = useState({})
  const [showSigPad, setShowSigPad] = useState(false)
  const [sigData, setSigData] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const doc = esignDocs.find(d => d.signToken === token)

  if (!doc) return <NotFound />

  const sigFields = doc.fields?.filter(f => f.type === 'handtekening') || []
  const otherFields = doc.fields?.filter(f => f.type !== 'handtekening') || []
  const allFilled = otherFields.every(f => fieldValues[f.id]?.trim()) && (sigFields.length === 0 || sigData)

  const handleSubmit = () => {
    if (!allFilled) return
    const updated = esignDocs.map(d => d.id === doc.id ? {
      ...d,
      status: 'signed',
      signedFields: { ...fieldValues, ...(sigData ? { [sigFields[0]?.id || 'sig']: sigData } : {}) },
      signatureData: sigData,
      signedAt: new Date().toISOString(),
    } : d)
    writeLocal('dhs_esign_docs', updated)
    setEsignDocs(updated)
    setSubmitted(true)
  }

  if (doc.status === 'signed' || submitted) return (
    <Success
      title="Document ondertekend"
      sub="Bedankt! Het document is succesvol ondertekend."
      showAppLink
    />
  )

  return (
    <div>
      {/* Document preview */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: 20, background: '#fff' }}>
        {doc.fileType === 'image'
          ? <img src={doc.fileData} style={{ display: 'block', width: '100%' }} alt="document" />
          : (
            <div style={{ position: 'relative' }}>
              <iframe
                src={doc.fileData}
                style={{ display: 'block', width: '100%', height: 'clamp(340px, 65vh, 720px)', border: 'none' }}
                title="document"
              />
              <div style={{ textAlign: 'center', padding: '6px 12px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8' }}>
                Scroll in het document om alle pagina's te bekijken
              </div>
            </div>
          )
        }
      </div>

      {/* Sign card */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{doc.name}</h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 24px' }}>Vul de gevraagde velden in en zet uw handtekening.</p>

        {otherFields.map(f => {
          const ft = ESIGN_FIELDS.find(t => t.id === f.type)
          return (
            <div key={f.id} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: ft?.color || '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {f.label}
              </label>
              <input
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '10px 13px', fontSize: 14, width: '100%', outline: 'none', boxSizing: 'border-box' }}
                type={f.type === 'datum' ? 'date' : 'text'}
                value={fieldValues[f.id] || ''}
                onChange={e => setFieldValues(v => ({ ...v, [f.id]: e.target.value }))}
                placeholder={f.type === 'naam' ? 'Uw volledige naam' : f.label}
              />
            </div>
          )
        })}

        {sigFields.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#6366f1', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Handtekening
            </label>
            {sigData
              ? (
                <div style={{ textAlign: 'center' }}>
                  <img src={sigData} alt="handtekening" style={{ maxHeight: 80, background: '#fff', borderRadius: 8, padding: 8, border: '1px solid #e2e8f0', display: 'block', margin: '0 auto 10px' }} />
                  <button onClick={() => setSigData(null)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#64748b' }}>
                    Opnieuw
                  </button>
                </div>
              )
              : showSigPad
                ? <SignaturePad onSave={d => { setSigData(d); setShowSigPad(false) }} onCancel={() => setShowSigPad(false)} />
                : (
                  <button onClick={() => setShowSigPad(true)}
                    style={{ width: '100%', border: '2px dashed #e2e8f0', borderRadius: 10, padding: 20, background: '#f8fafc', color: '#94a3b8', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <PenLine size={16} /> Klik hier om te ondertekenen
                  </button>
                )
            }
          </div>
        )}

        <button onClick={handleSubmit} disabled={!allFilled}
          style={{ width: '100%', background: allFilled ? '#10b981' : '#f1f5f9', border: 'none', borderRadius: 10, padding: 14, color: allFilled ? '#fff' : '#94a3b8', fontSize: 15, fontWeight: 700, cursor: allFilled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Check size={18} /> Document ondertekenen &amp; bevestigen
        </button>
      </div>
    </div>
  )
}

// ── Quote sign view ───────────────────────────────────────────────────────────
const QuoteView = ({ token }) => {
  const [quotes, setQuotes] = useState(() => readLocal('quotes') || [])
  const [clients] = useState(() => readLocal('clients') || [])
  const [signerName, setSignerName] = useState('')
  const [step, setStep] = useState('review')
  const [sigData, setSigData] = useState(null)
  const [showSigPad, setShowSigPad] = useState(false)

  const quote = quotes.find(q => q.signToken === token)
  const client = clients.find(c => c.id === quote?.clientId)

  if (!quote) return <NotFound msg="De offerte is niet gevonden. Controleer de link of neem contact op met de afzender." />

  const handleSign = (sig) => {
    const signedAt = new Date().toISOString()
    const updated = quotes.map(q => q.id === quote.id ? {
      ...q, status: 'accepted', signedAt, signatureData: sig, signerName,
      history: [...(q.history || []), { status: 'accepted', at: signedAt, by: signerName }],
    } : q)
    writeLocal('quotes', updated)
    setQuotes(updated)
    setStep('done')
  }

  if (step === 'done' || quote.status === 'accepted') return (
    <Success
      title="Offerte geaccepteerd"
      sub={`Ondertekend${signerName ? ` door ${signerName}` : ''}${quote.signedAt ? ` op ${fmtDate(quote.signedAt)}` : ''}.`}
      showAppLink
    />
  )

  const totals = (quote.items || []).reduce((acc, it) => {
    const net = Number(it.quantity || 0) * Number(it.price || 0)
    return { sub: acc.sub + net, btw: acc.btw + net * (Number(it.btwRate || 0) / 100) }
  }, { sub: 0, btw: 0 })

  const fmtEUR = n => '€\u00a0' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2 })

  return (
    <div>
      {/* Quote card */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Offerte {quote.number}</h2>
            {client && <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Voor: <strong>{client.name}</strong></p>}
          </div>
          {quote.validUntil && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#64748b' }}>
              Geldig tot {fmtDate(quote.validUntil)}
            </div>
          )}
        </div>

        {quote.items?.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>Omschrijving</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((it, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 0', fontSize: 13, color: '#334155', borderBottom: '1px solid #f8fafc' }}>{it.description}</td>
                  <td style={{ padding: '10px 0', fontSize: 13, color: '#334155', textAlign: 'right', borderBottom: '1px solid #f8fafc', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtEUR(Number(it.quantity || 0) * Number(it.price || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '2px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              <span>Subtotaal</span><span>{fmtEUR(totals.sub)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              <span>BTW</span><span>{fmtEUR(totals.btw)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              <span>Totaal</span><span>{fmtEUR(totals.sub + totals.btw)}</span>
            </div>
          </div>
        </div>
      </div>

      {step === 'review' && (
        <button onClick={() => setStep('sign')}
          style={{ width: '100%', background: '#10b981', border: 'none', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Check size={18} /> Accepteren &amp; ondertekenen
        </button>
      )}

      {step === 'sign' && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Ondertekenen</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Uw naam</label>
            <input
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '10px 13px', fontSize: 14, width: '100%', outline: 'none', boxSizing: 'border-box' }}
              value={signerName} onChange={e => setSignerName(e.target.value)}
              placeholder="Voor- en achternaam"
            />
          </div>
          <label style={{ display: 'block', color: '#6366f1', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Handtekening</label>
          {sigData
            ? (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img src={sigData} alt="handtekening" style={{ maxHeight: 80, background: '#fff', borderRadius: 8, padding: 8, border: '1px solid #e2e8f0', display: 'block', margin: '0 auto 10px' }} />
                <button onClick={() => setSigData(null)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: '#64748b' }}>Opnieuw</button>
              </div>
            )
            : showSigPad
              ? <SignaturePad onSave={d => { setSigData(d); setShowSigPad(false) }} onCancel={() => setShowSigPad(false)} />
              : (
                <button onClick={() => setShowSigPad(true)}
                  style={{ width: '100%', border: '2px dashed #e2e8f0', borderRadius: 10, padding: 20, background: '#f8fafc', color: '#94a3b8', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                  <Pen size={16} /> Klik hier om te ondertekenen
                </button>
              )
          }
          {sigData && (
            <button onClick={() => handleSign(sigData)} disabled={!signerName.trim()}
              style={{ width: '100%', background: signerName.trim() ? '#10b981' : '#f1f5f9', border: 'none', borderRadius: 10, padding: 14, color: signerName.trim() ? '#fff' : '#94a3b8', fontSize: 15, fontWeight: 700, cursor: signerName.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Check size={18} /> Bevestigen &amp; ondertekenen
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PublicSignPage({ signToken }) {
  const isEsign = signToken?.startsWith('esign_')

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body, html { margin: 0; padding: 0; background: #f1f5f9; -webkit-text-size-adjust: 100%; }
        input, button, textarea { font-family: inherit; }
        input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
      `}</style>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileSignature size={17} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>DHS Finance</div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.2 }}>Digitaal ondertekenen</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 56px' }}>
        {isEsign ? <EsignView token={signToken} /> : <QuoteView token={signToken} />}
      </div>
    </div>
  )
}
