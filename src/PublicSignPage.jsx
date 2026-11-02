import { useState, useRef, useEffect } from 'react'
import { FileSignature, CheckCircle2, Check, AlertCircle, PenLine, Loader2, X, Info } from 'lucide-react'
import { supabase, isSupabaseConfigured } from './supabase'
import { lineNet } from './finance'
import { Button, Card, Input, Money } from './ui'

// Publieke pagina voor klanten zonder account (?sign=TOKEN).
// Offertes lopen via de RPC's get_quote_by_token / sign_quote (migratie v7):
// de klant ziet alleen wat de RPC teruggeeft en kan precies één keer accepteren of afwijzen.

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

const readLocal = (key) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null } catch { return null }
}
const writeLocal = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* opslag niet beschikbaar */ }
}

// Serverfout → leesbare tekst voor de klant
const friendlyError = (msg = '') => {
  if (/al verwerkt/i.test(msg)) return 'Deze offerte is al geaccepteerd of afgewezen.'
  if (/verlopen/i.test(msg)) return 'Deze offerte is verlopen. Neem contact op met de afzender voor een nieuwe offerte.'
  if (/niet gevonden|ongeldige link/i.test(msg)) return 'Deze link is ongeldig of verlopen.'
  if (/naam is verplicht/i.test(msg)) return 'Vul je naam in (maximaal 200 tekens).'
  if (/handtekening/i.test(msg)) return 'De handtekening kon niet worden verwerkt. Zet je handtekening opnieuw.'
  if (/failed to fetch|network/i.test(msg)) return 'Geen verbinding met de server. Controleer je internet en probeer het opnieuw.'
  return msg || 'Er ging iets mis. Probeer het later opnieuw.'
}

const ESIGN_FIELDS = [
  { id: 'handtekening', label: 'Handtekening' },
  { id: 'naam',         label: 'Naam' },
  { id: 'datum',        label: 'Datum' },
  { id: 'tekst',        label: 'Vrije tekst' },
]

const fieldLabel = 'block text-[12.5px] font-medium mb-1.5'

// ── Handtekening-pad ─────────────────────────────────────────────────────────
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
        aria-label="Tekenvlak voor handtekening"
        style={{ background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--border-2)', cursor: 'crosshair', touchAction: 'none', display: 'block', width: '100%' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <div className="flex gap-2 mt-2.5 flex-wrap">
        <Button variant="secondary" size="sm" onClick={clear}>Wissen</Button>
        <Button size="sm" onClick={() => onSave(canvasRef.current.toDataURL('image/png'))} disabled={empty}>
          <Check size={14} /> Bevestigen
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Annuleren</Button>
      </div>
    </div>
  )
}

const SignatureField = ({ sigData, setSigData }) => {
  const [showPad, setShowPad] = useState(false)
  if (sigData) return (
    <div className="text-center">
      <img src={sigData} alt="Handtekening" className="block mx-auto mb-2.5" style={{ maxHeight: 80, background: '#fff', borderRadius: 8, padding: 8, border: '1px solid var(--border-2)' }} />
      <Button variant="secondary" size="sm" onClick={() => setSigData(null)}>Opnieuw</Button>
    </div>
  )
  if (showPad) return <SignaturePad onSave={d => { setSigData(d); setShowPad(false) }} onCancel={() => setShowPad(false)} />
  return (
    <button
      type="button"
      onClick={() => setShowPad(true)}
      className="w-full flex items-center justify-center gap-2 text-[13px] p-5"
      style={{ border: '2px dashed var(--border-3)', borderRadius: 'var(--radius)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer' }}
    >
      <PenLine size={16} /> Klik hier om te ondertekenen
    </button>
  )
}

// ── Statusschermen ───────────────────────────────────────────────────────────
const Notice = ({ icon: Icon = AlertCircle, title, msg, tone = 'muted' }) => (
  <div className="text-center px-5 py-14">
    <Icon size={44} className="mx-auto mb-4 block" style={{ color: tone === 'success' ? 'var(--success)' : 'var(--text-3)' }} />
    <h2 className="text-[20px] font-semibold mb-2" style={{ color: 'var(--text)' }}>{title}</h2>
    <p className="text-[14px] m-0 max-w-md mx-auto" style={{ color: 'var(--text-2)' }}>{msg}</p>
  </div>
)

const ErrorBox = ({ children }) => (
  <div role="alert" className="rounded-[10px] px-3.5 py-2.5 mb-4 text-[13px]" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
    {children}
  </div>
)

// ── E-sign (nog alleen lokaal) ───────────────────────────────────────────────
// E-sign-documenten staan (nog) alleen in de localStorage van de afzender; er is geen
// serveropslag of publieke RPC voor. De link werkt daardoor alleen op het apparaat van de afzender.
const EsignView = ({ token }) => {
  const [esignDocs, setEsignDocs] = useState(() => readLocal('dhs_esign_docs') || [])
  const [fieldValues, setFieldValues] = useState({})
  const [sigData, setSigData] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const doc = esignDocs.find(d => d.signToken === token)

  if (!doc) return (
    <Notice
      icon={Info}
      title="Deze link werkt (nog) niet op dit apparaat"
      msg="Digitaal ondertekenen van losse documenten werkt voorlopig alleen op het apparaat van de afzender. Neem contact op met de afzender om het document op een andere manier te ondertekenen."
    />
  )

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
    <Notice icon={CheckCircle2} tone="success" title="Document ondertekend" msg="Bedankt! Het document is ondertekend." />
  )

  return (
    <div>
      <div className="rounded-[10px] px-3.5 py-2.5 mb-4 text-[13px] flex gap-2 items-start" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>Let op: dit document wordt alleen op dit apparaat opgeslagen. Ondertekenen via een link op een ander apparaat werkt nog niet.</span>
      </div>

      <Card className="overflow-hidden mb-5">
        {doc.fileType === 'image'
          ? <img src={doc.fileData} className="block w-full" alt="Document" />
          : <iframe src={doc.fileData} className="block w-full border-0" style={{ height: 'clamp(340px, 65vh, 720px)' }} title="Document" />
        }
      </Card>

      <Card className="p-6">
        <h2 className="text-[18px] font-semibold mb-1">{doc.name}</h2>
        <p className="text-[13px] mb-6" style={{ color: 'var(--text-2)' }}>Vul de gevraagde velden in en zet je handtekening.</p>

        {otherFields.map(f => (
          <Input
            key={f.id}
            className="mb-4"
            label={f.label || ESIGN_FIELDS.find(t => t.id === f.type)?.label}
            type={f.type === 'datum' ? 'date' : 'text'}
            value={fieldValues[f.id] || ''}
            onChange={e => setFieldValues(v => ({ ...v, [f.id]: e.target.value }))}
            placeholder={f.type === 'naam' ? 'Je volledige naam' : f.label}
          />
        ))}

        {sigFields.length > 0 && (
          <div className="mb-6">
            <span className={fieldLabel} style={{ color: 'var(--text-2)' }}>Handtekening</span>
            <SignatureField sigData={sigData} setSigData={setSigData} />
          </div>
        )}

        <Button size="lg" className="w-full" onClick={handleSubmit} disabled={!allFilled}>
          <Check size={18} /> Document ondertekenen
        </Button>
      </Card>
    </div>
  )
}

// ── Offerte ondertekenen ─────────────────────────────────────────────────────
const QuoteView = ({ token }) => {
  const [state, setState] = useState({ loading: true, quote: null, error: '' })
  const [signerName, setSignerName] = useState('')
  const [step, setStep] = useState('review') // review | sign | decline | done
  const [sigData, setSigData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!isSupabaseConfigured) {
        setState({ loading: false, quote: null, error: 'De server is niet bereikbaar.' })
        return
      }
      const { data, error } = await supabase.rpc('get_quote_by_token', { p_token: token })
      if (cancelled) return
      if (error) setState({ loading: false, quote: null, error: friendlyError(error.message) })
      else setState({ loading: false, quote: data || null, error: '' })
    }
    load()
    return () => { cancelled = true }
  }, [token])

  if (state.loading) return (
    <div className="flex items-center justify-center gap-2 py-16 text-[14px]" style={{ color: 'var(--text-2)' }}>
      <Loader2 size={16} className="animate-spin" /> Offerte laden…
    </div>
  )
  if (state.error) return <Notice title="Offerte kon niet worden geladen" msg={state.error} />
  const quote = state.quote
  if (!quote) return <Notice title="Deze link is ongeldig of verlopen" msg="Controleer de link of neem contact op met de afzender." />

  const submit = async (status) => {
    setSubmitError('')
    if (!signerName.trim()) { setSubmitError('Vul je naam in.'); return }
    if (status === 'accepted' && !sigData) { setSubmitError('Zet eerst je handtekening.'); return }
    setSubmitting(true)
    const { data, error } = await supabase.rpc('sign_quote', {
      p_token: token,
      p_name: signerName.trim(),
      p_signature: status === 'accepted' ? sigData : null,
      p_status: status,
    })
    setSubmitting(false)
    if (error) { setSubmitError(friendlyError(error.message)); return }
    setResult(data || { status, signedByName: signerName.trim(), signedAt: new Date().toISOString() })
    setStep('done')
  }

  const final = result || (quote.signedAt || ['accepted', 'declined', 'converted'].includes(quote.status)
    ? { status: quote.status === 'declined' ? 'declined' : 'accepted', signedAt: quote.signedAt, signedByName: quote.signedByName }
    : null)

  if (final) {
    const by = `${final.signedByName ? ` door ${final.signedByName}` : ''}${final.signedAt ? ` op ${fmtDate(final.signedAt)}` : ''}`
    return final.status === 'declined'
      ? <Notice icon={X} title="Offerte afgewezen" msg={`Afgewezen${by}. De afzender is hiervan op de hoogte.`} />
      : <Notice icon={CheckCircle2} tone="success" title="Offerte geaccepteerd" msg={`Ondertekend${by}. Bedankt!`} />
  }

  const expired = quote.validUntil && quote.validUntil < new Date().toISOString().slice(0, 10)
  const currency = quote.currency || 'EUR'
  const items = quote.items || []
  const computed = items.reduce((acc, it) => {
    const { net } = lineNet(it)
    return { sub: acc.sub + net, btw: acc.btw + net * (Number(it.btwRate || 0) / 100) }
  }, { sub: 0, btw: 0 })
  const subtotal = quote.subtotal != null ? Number(quote.subtotal) : computed.sub
  const btwTotal = quote.btwTotal != null ? Number(quote.btwTotal) : computed.btw
  const total = quote.total != null ? Number(quote.total) : subtotal + btwTotal

  return (
    <div>
      <Card className="p-6 mb-4">
        <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div>
            {quote.companyName && <p className="text-[12.5px] mb-1" style={{ color: 'var(--text-3)' }}>{quote.companyName}</p>}
            <h2 className="text-[20px] font-semibold mb-1">Offerte {quote.number}</h2>
            {quote.clientName && <p className="text-[13px] m-0" style={{ color: 'var(--text-2)' }}>Voor: <strong>{quote.clientName}</strong></p>}
          </div>
          {quote.validUntil && (
            <div className="rounded-[8px] px-3 py-1.5 text-[12px]" style={{ background: expired ? 'var(--danger-soft)' : 'var(--surface-2)', color: expired ? 'var(--danger)' : 'var(--text-2)', border: '1px solid var(--border)' }}>
              {expired ? 'Verlopen op' : 'Geldig tot'} {fmtDate(quote.validUntil)}
            </div>
          )}
        </div>

        {quote.subject && <p className="text-[14px] font-medium mb-2">{quote.subject}</p>}
        {quote.intro && <p className="text-[13.5px] mb-4 whitespace-pre-line" style={{ color: 'var(--text-2)' }}>{quote.intro}</p>}

        {items.length > 0 && (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="text-left py-2 text-[11.5px] font-medium" style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>Omschrijving</th>
                <th className="text-right py-2 text-[11.5px] font-medium" style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="py-2.5 text-[13px]" style={{ borderBottom: '1px solid var(--border)' }}>
                    {it.description}
                    {Number(it.quantity) !== 1 && <span style={{ color: 'var(--text-3)' }}> · {it.quantity} × <Money value={it.price} currency={currency} /></span>}
                  </td>
                  <td className="py-2.5 text-[13px] text-right" style={{ borderBottom: '1px solid var(--border)' }}>
                    <Money value={lineNet(it).net} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 pt-3.5 flex justify-end" style={{ borderTop: '1px solid var(--border-2)' }}>
          <div style={{ minWidth: 200 }}>
            <div className="flex justify-between text-[12.5px] mb-1" style={{ color: 'var(--text-2)' }}><span>Subtotaal</span><Money value={subtotal} currency={currency} /></div>
            <div className="flex justify-between text-[12.5px] mb-2" style={{ color: 'var(--text-2)' }}><span>Btw</span><Money value={btwTotal} currency={currency} /></div>
            <div className="flex justify-between text-[16px] font-semibold"><span>Totaal</span><Money value={total} currency={currency} /></div>
          </div>
        </div>

        {quote.notes && <p className="text-[12.5px] mt-5 whitespace-pre-line" style={{ color: 'var(--text-3)' }}>{quote.notes}</p>}
      </Card>

      {expired ? (
        <Notice title="Deze offerte is verlopen" msg="Neem contact op met de afzender voor een nieuwe offerte." />
      ) : step === 'review' ? (
        <div className="flex flex-col gap-2">
          <Button size="lg" className="w-full" onClick={() => { setStep('sign'); setSubmitError('') }}>
            <Check size={18} /> Accepteren en ondertekenen
          </Button>
          <Button variant="ghost" size="md" className="w-full" onClick={() => { setStep('decline'); setSubmitError('') }}>
            Offerte afwijzen
          </Button>
        </div>
      ) : (
        <Card className="p-6">
          <h3 className="text-[16px] font-semibold mb-4">{step === 'sign' ? 'Ondertekenen' : 'Offerte afwijzen'}</h3>
          {submitError && <ErrorBox>{submitError}</ErrorBox>}
          <Input
            className="mb-4"
            label="Je naam"
            maxLength={200}
            value={signerName}
            onChange={e => setSignerName(e.target.value)}
            placeholder="Voor- en achternaam"
          />
          {step === 'sign' && (
            <div className="mb-4">
              <span className={fieldLabel} style={{ color: 'var(--text-2)' }}>Handtekening</span>
              <SignatureField sigData={sigData} setSigData={setSigData} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {step === 'sign' ? (
              <Button size="lg" className="w-full" onClick={() => submit('accepted')} disabled={submitting || !sigData || !signerName.trim()}>
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Bezig…</> : <><Check size={18} /> Bevestigen en ondertekenen</>}
              </Button>
            ) : (
              <Button variant="danger" size="lg" className="w-full" onClick={() => submit('declined')} disabled={submitting || !signerName.trim()}>
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Bezig…</> : <>Offerte definitief afwijzen</>}
              </Button>
            )}
            <Button variant="ghost" size="md" className="w-full" onClick={() => { setStep('review'); setSubmitError('') }} disabled={submitting}>
              Terug
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Hoofdcomponent ───────────────────────────────────────────────────────────
export default function PublicSignPage({ signToken }) {
  const isEsign = signToken?.startsWith('esign_')

  // Klantpagina altijd in licht thema
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
      <header className="sticky top-0 z-50 flex items-center gap-2.5 px-5 py-3.5" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
          <FileSignature size={17} color="#fff" />
        </div>
        <div>
          <div className="text-[14px] font-semibold leading-tight">DHS Finance</div>
          <div className="text-[11.5px] leading-tight" style={{ color: 'var(--text-3)' }}>Digitaal ondertekenen</div>
        </div>
      </header>

      <main className="mx-auto px-4 pt-6 pb-14" style={{ maxWidth: 680 }}>
        {isEsign ? <EsignView token={signToken} /> : <QuoteView token={signToken} />}
      </main>
    </div>
  )
}
