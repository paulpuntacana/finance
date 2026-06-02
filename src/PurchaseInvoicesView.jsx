import { useState, useMemo, useRef } from 'react'
import {
  Plus, Trash2, Edit3, Check, X, Paperclip, Download,
  FileText, CheckCircle2, Clock, Euro, Search, Repeat, RefreshCw,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtEUR = (n) => {
  const num = Number(n || 0)
  return '€ ' + num.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
const todayISO = () => new Date().toISOString().split('T')[0]
const genId = () => `pi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => resolve(e.target.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Software & Abonnementen', 'AI & Automatisering', 'Hosting & Cloud', 'Marketing',
  'Kantoor', 'Telefoon & Internet', 'Verzekering', 'Juridisch & Administratie',
  'Opleiding & Cursussen', 'Reiskosten', 'Overig',
]
const SUPPLIER_SUGGESTIONS = [
  'Anthropic (Claude)', 'Make.com', 'Vercel', 'OpenAI', 'GitHub', 'Adobe',
  'Microsoft 365', 'Google Workspace', 'Stripe', 'Mailchimp', 'Zapier',
  'Notion', 'Linear', 'Figma', 'Slack', 'Zoom', 'Dropbox', 'ChatGPT',
]

// ── UI primitives ─────────────────────────────────────────────────────────────
const inp = {
  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
  borderRadius: '8px', color: 'var(--text)', padding: '9px 12px',
  fontSize: '13px', width: '100%', outline: 'none', boxSizing: 'border-box',
}
const th = {
  textAlign: 'left', padding: '10px 16px', color: 'var(--text-3)',
  fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
  letterSpacing: '0.06em', borderBottom: '1px solid var(--border)',
}
const td = {
  padding: '11px 16px', color: 'var(--text)', fontSize: '13px',
  borderBottom: '1px solid var(--border)',
}
const Card = ({ children, style = {} }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', ...style }}>
    {children}
  </div>
)
const Label = ({ children }) => (
  <div style={{ color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
    {children}
  </div>
)

// ── Empty form factory ────────────────────────────────────────────────────────
const emptyForm = () => ({
  supplier: '', invoiceNumber: '', date: todayISO(), dueDate: '',
  amount: '', btwRate: 21, btwAmount: '', totalAmount: '',
  currency: 'EUR', category: '', status: 'unpaid', paidAt: '',
  attachment: '', attachmentName: '', notes: '',
  recurring: false, recurringPeriod: 'monthly',
})

// ── Add/Edit Modal ────────────────────────────────────────────────────────────
function PurchaseInvoiceModal({ invoice, onSave, onClose }) {
  const [form, setForm] = useState(invoice ? { ...emptyForm(), ...invoice } : emptyForm())
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const filteredSuggestions = useMemo(() =>
    form.supplier.length > 0
      ? SUPPLIER_SUGGESTIONS.filter(s => s.toLowerCase().includes(form.supplier.toLowerCase()))
      : [],
    [form.supplier]
  )

  const recalc = (f) => {
    const excl = parseFloat(f.amount) || 0
    const rate = parseFloat(f.btwRate) || 0
    const btw = +(excl * (rate / 100)).toFixed(2)
    return { ...f, btwAmount: btw, totalAmount: +(excl + btw).toFixed(2) }
  }

  const update = (key, val) => setForm(f => recalc({ ...f, [key]: val }))

  const handleFile = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setForm(f => ({ ...f, attachment: dataUrl, attachmentName: file.name }))
    } finally {
      setUploading(false)
    }
  }

  const isValid = form.supplier.trim() && form.date &&
    (parseFloat(form.totalAmount) > 0 || parseFloat(form.amount) > 0)

  const handleSave = () => {
    if (!isValid) return
    const saved = recalc(form)
    onSave({ ...saved, id: invoice?.id || genId(), createdAt: invoice?.createdAt || new Date().toISOString() })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
            {invoice ? 'Factuur bewerken' : 'Inkomende factuur toevoegen'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Supplier with autocomplete */}
          <div style={{ position: 'relative' }}>
            <Label>Leverancier *</Label>
            <input
              style={inp}
              value={form.supplier}
              onChange={e => { update('supplier', e.target.value); setShowSuggestions(true) }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="bijv. Make.com, Anthropic, Vercel..."
              autoComplete="off"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '8px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginTop: '2px', overflow: 'hidden' }}>
                {filteredSuggestions.slice(0, 5).map(s => (
                  <button key={s} onMouseDown={() => { update('supplier', s); setShowSuggestions(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Invoice number + category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <Label>Factuurnummer</Label>
              <input style={inp} value={form.invoiceNumber} onChange={e => update('invoiceNumber', e.target.value)} placeholder="bijv. INV-2025-001" />
            </div>
            <div>
              <Label>Categorie</Label>
              <select style={inp} value={form.category} onChange={e => update('category', e.target.value)}>
                <option value="">Kies...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <Label>Factuurdatum *</Label>
              <input type="date" style={inp} value={form.date} onChange={e => update('date', e.target.value)} />
            </div>
            <div>
              <Label>Vervaldatum</Label>
              <input type="date" style={inp} value={form.dueDate} onChange={e => update('dueDate', e.target.value)} />
            </div>
          </div>

          {/* Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '12px', alignItems: 'end' }}>
            <div>
              <Label>Bedrag excl. BTW (€) *</Label>
              <input type="number" style={inp} value={form.amount} onChange={e => update('amount', e.target.value)} placeholder="0.00" min="0" step="0.01" />
            </div>
            <div>
              <Label>BTW %</Label>
              <select style={inp} value={form.btwRate} onChange={e => update('btwRate', Number(e.target.value))}>
                {[0, 9, 21].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <Label>Totaal incl. BTW</Label>
              <div style={{ ...inp, background: 'var(--surface-3)', color: 'var(--text-2)', cursor: 'default', fontFamily: 'monospace' }}>
                {fmtEUR(form.totalAmount || 0)}
              </div>
            </div>
          </div>

          {/* Status + recurring */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <Label>Status</Label>
              <select style={inp} value={form.status} onChange={e => update('status', e.target.value)}>
                <option value="unpaid">Te betalen</option>
                <option value="paid">Betaald</option>
              </select>
            </div>
            {form.status === 'paid' ? (
              <div>
                <Label>Betaald op</Label>
                <input type="date" style={inp} value={form.paidAt} onChange={e => update('paidAt', e.target.value)} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.recurring} onChange={e => update('recurring', e.target.checked)} />
                  Terugkerend
                </label>
                {form.recurring && (
                  <select style={{ ...inp, width: 'auto', padding: '6px 10px', marginLeft: '8px' }} value={form.recurringPeriod} onChange={e => update('recurringPeriod', e.target.value)}>
                    <option value="monthly">Maandelijks</option>
                    <option value="yearly">Jaarlijks</option>
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Attachment */}
          <div>
            <Label>Bijlage (PDF / afbeelding)</Label>
            <input ref={fileInputRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
            {form.attachment ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <FileText size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {form.attachmentName || 'Bijlage'}
                </span>
                <a href={form.attachment} download={form.attachmentName || 'bijlage'} style={{ color: 'var(--text-3)', display: 'flex', padding: '2px' }}>
                  <Download size={14} />
                </a>
                <button onClick={() => setForm(f => ({ ...f, attachment: '', attachmentName: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', padding: '2px' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: '8px', padding: '9px 14px', color: 'var(--text-3)', fontSize: '13px', cursor: 'pointer' }}>
                <Paperclip size={14} />
                {uploading ? 'Uploaden...' : 'Bestand toevoegen'}
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>Notities</Label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: '64px' }} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Optioneel..." />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 14px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>
            Annuleren
          </button>
          <button onClick={handleSave} disabled={!isValid}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isValid ? 'var(--accent)' : 'var(--surface-3)', border: 'none', borderRadius: '8px', padding: '9px 18px', color: isValid ? '#fff' : 'var(--text-3)', fontSize: '13px', fontWeight: '600', cursor: isValid ? 'pointer' : 'not-allowed' }}>
            <Check size={14} /> {invoice ? 'Opslaan' : 'Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PurchaseInvoicesView({ purchaseInvoices, setPurchaseInvoices, allPurchaseInvoices, settings, activeEntity }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const filtered = useMemo(() => {
    let list = purchaseInvoices || []
    if (filter === 'unpaid') list = list.filter(i => i.status === 'unpaid')
    if (filter === 'paid') list = list.filter(i => i.status === 'paid')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.supplier?.toLowerCase().includes(q) ||
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
  }, [purchaseInvoices, filter, search])

  const unpaidCount = (purchaseInvoices || []).filter(i => i.status === 'unpaid').length
  const unpaidTotal = (purchaseInvoices || []).filter(i => i.status === 'unpaid').reduce((s, i) => s + Number(i.totalAmount || 0), 0)
  const thisMonthTotal = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return (purchaseInvoices || []).filter(i => i.date && new Date(i.date) >= start).reduce((s, i) => s + Number(i.totalAmount || 0), 0)
  }, [purchaseInvoices])

  const handleSave = (item) => {
    const all = allPurchaseInvoices || purchaseInvoices
    const exists = (all || []).find(i => i.id === item.id)
    if (exists) {
      setPurchaseInvoices((all || []).map(i => i.id === item.id ? { ...i, ...item } : i))
    } else {
      setPurchaseInvoices([{ ...item, entityId: activeEntity?.id }, ...(all || [])])
    }
    setShowModal(false)
    setEditItem(null)
  }

  const handleDelete = (id) => {
    if (!confirm('Factuur verwijderen?')) return
    const all = allPurchaseInvoices || purchaseInvoices
    setPurchaseInvoices((all || []).filter(i => i.id !== id))
  }

  const handleMarkPaid = (item) => {
    const all = allPurchaseInvoices || purchaseInvoices
    setPurchaseInvoices((all || []).map(i => i.id === item.id ? { ...i, status: 'paid', paidAt: i.paidAt || todayISO() } : i))
  }

  const handleMarkUnpaid = (item) => {
    const all = allPurchaseInvoices || purchaseInvoices
    setPurchaseInvoices((all || []).map(i => i.id === item.id ? { ...i, status: 'unpaid', paidAt: '' } : i))
  }

  const isDueStatus = (item) => {
    if (item.status !== 'unpaid' || !item.dueDate) return null
    const due = new Date(item.dueDate)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (due < today) return 'overdue'
    if ((due - today) / 86400000 <= 7) return 'soon'
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Inkoop</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>Inkomende facturen van leveranciers</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowModal(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '9px 16px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
          <Plus size={15} /> Factuur toevoegen
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'Openstaand', value: fmtEUR(unpaidTotal), sub: `${unpaidCount} factuur${unpaidCount !== 1 ? 'en' : ''}`, color: unpaidCount > 0 ? 'var(--danger)' : 'var(--text)' },
          { label: 'Deze maand', value: fmtEUR(thisMonthTotal), color: 'var(--text)' },
          { label: 'Totaal facturen', value: String((purchaseInvoices || []).length), color: 'var(--text)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '20px', color: s.color }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Filter + search */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px' }}>
          {[
            { id: 'all', label: 'Alles' },
            { id: 'unpaid', label: `Te betalen${unpaidCount > 0 ? ` (${unpaidCount})` : ''}` },
            { id: 'paid', label: 'Betaald' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: filter === f.id ? '600' : '500', background: filter === f.id ? 'var(--surface)' : 'transparent', color: filter === f.id ? 'var(--text)' : 'var(--text-3)', boxShadow: filter === f.id ? '0 1px 4px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.1s' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input style={{ ...inp, paddingLeft: '32px' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op leverancier of nummer..." />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Euro size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>
              {filter === 'all' && !search
                ? 'Nog geen inkomende facturen. Voeg je eerste leveranciersfactuur toe (Make.com, Claude, Vercel...).'
                : 'Geen facturen gevonden voor dit filter.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Leverancier', 'Nummer', 'Datum', 'Vervalt', 'Bedrag', 'Categorie', 'Status', 'Acties'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const due = isDueStatus(item)
                  return (
                    <tr key={item.id} style={{ background: due === 'overdue' ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '500' }}>{item.supplier || '—'}</span>
                          {item.recurring && (
                            <Repeat size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} title={item.recurringPeriod === 'monthly' ? 'Maandelijks' : 'Jaarlijks'} />
                          )}
                          {item.attachment && (
                            <Paperclip size={11} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                          )}
                        </div>
                      </td>
                      <td style={{ ...td, fontSize: '12px', color: 'var(--text-3)', fontFamily: 'monospace' }}>{item.invoiceNumber || '—'}</td>
                      <td style={{ ...td, fontSize: '12px', color: 'var(--text-2)' }}>{fmtDate(item.date)}</td>
                      <td style={td}>
                        {item.dueDate ? (
                          <span style={{ fontSize: '12px', color: due === 'overdue' ? 'var(--danger)' : due === 'soon' ? 'var(--warning)' : 'var(--text-2)' }}>
                            {fmtDate(item.dueDate)}
                            {due === 'overdue' && <span style={{ display: 'block', fontSize: '10px', fontWeight: '600' }}>Verlopen</span>}
                            {due === 'soon' && <span style={{ display: 'block', fontSize: '10px', fontWeight: '600' }}>Bijna verlopen</span>}
                          </span>
                        ) : <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>—</span>}
                      </td>
                      <td style={td}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: item.status === 'unpaid' ? 'var(--danger)' : 'var(--text-2)' }}>
                          {fmtEUR(item.totalAmount)}
                        </span>
                        {Number(item.btwAmount) > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>excl. {fmtEUR(item.amount)}</div>
                        )}
                      </td>
                      <td style={{ ...td, fontSize: '12px', color: 'var(--text-3)' }}>{item.category || '—'}</td>
                      <td style={td}>
                        {item.status === 'paid' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '10px', background: 'var(--success-soft)', color: 'var(--success)', cursor: 'pointer' }}
                            onClick={() => handleMarkUnpaid(item)} title="Klik om terug te zetten naar te betalen">
                            <CheckCircle2 size={11} /> Betaald
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '10px', background: due === 'overdue' ? 'var(--danger-soft)' : 'var(--warning-soft)', color: due === 'overdue' ? 'var(--danger)' : 'var(--warning)' }}>
                            <Clock size={11} /> Te betalen
                          </span>
                        )}
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {item.status === 'unpaid' && (
                            <button onClick={() => handleMarkPaid(item)} title="Markeer als betaald"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--success-soft)', border: 'none', borderRadius: '6px', padding: '4px 9px', color: 'var(--success)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                              <Check size={11} /> Betaald
                            </button>
                          )}
                          {item.attachment && (
                            <a href={item.attachment} download={item.attachmentName || 'bijlage'} title="Download bijlage"
                              style={{ display: 'flex', alignItems: 'center', padding: '4px 7px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-3)' }}>
                              <Download size={12} />
                            </a>
                          )}
                          <button onClick={() => { setEditItem(item); setShowModal(true) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px', display: 'flex' }}>
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => handleDelete(item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', display: 'flex' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <PurchaseInvoiceModal
          invoice={editItem}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}
