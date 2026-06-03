import { useState, useMemo } from 'react'
import {
  Plus, Trash2, Edit3, TrendingUp, RotateCcw,
  ChevronDown, ChevronRight, Car, Monitor, Building2, Package,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────
const ASSET_CATEGORIES = ['Auto', 'Hardware', 'Meubilair', 'Machine', 'Inventaris', 'Software', 'Overig']
const ENTRY_CATEGORIES = ['Correctie', 'Restverschil', 'Terugboeking', 'Extra afschrijving', 'Omzetaanpassing', 'Kostenpost', 'Overig']

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
const genId = () => `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

// Compute depreciation schedule for an asset (linear method)
const computeAsset = (asset) => {
  const purchaseValue = parseFloat(asset.purchase_value) || 0
  const residualValue = parseFloat(asset.residual_value) || 0
  const years = parseInt(asset.depreciation_years) || 1
  const annualDep = years > 0 ? (purchaseValue - residualValue) / years : 0
  const purchaseYear = asset.purchase_date
    ? new Date(asset.purchase_date).getFullYear()
    : new Date().getFullYear()

  const schedule = Array.from({ length: years }, (_, y) => {
    const startValue = purchaseValue - annualDep * y
    const endValue = Math.max(residualValue, startValue - annualDep)
    return { year: purchaseYear + y, depreciation: annualDep, startValue, endValue }
  })

  const currentYear = new Date().getFullYear()
  const yearsElapsed = Math.max(0, currentYear - purchaseYear)
  const currentBookValue = Math.max(residualValue, purchaseValue - annualDep * yearsElapsed)
  const isFullyDepreciated = yearsElapsed >= years

  return { annualDep, schedule, currentBookValue, yearsElapsed, isFullyDepreciated }
}

const getDepreciationForYear = (assets, year) =>
  (assets || [])
    .filter(a => a.is_active !== false)
    .reduce((sum, asset) => {
      const { schedule } = computeAsset(asset)
      const entry = schedule.find(s => s.year === year)
      return sum + (entry ? entry.depreciation : 0)
    }, 0)

// Shared invoice subtotal excl. BTW
const invoiceExBtw = (items = []) =>
  items.reduce((sum, it) => {
    const base = Number(it.quantity || 0) * Number(it.price || 0)
    let discount = 0
    if (it.discount && Number(it.discount.value) > 0) {
      discount = it.discount.type === 'percent'
        ? base * (Number(it.discount.value) / 100)
        : Number(it.discount.value)
    }
    return sum + Math.max(0, base - discount)
  }, 0)

// ── Shared UI primitives ──────────────────────────────────────────────────────
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

// ── Winst/Verlies tab ─────────────────────────────────────────────────────────
function WinstVerliesTab({ invoices, expenses, assets, entries, clients }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [open, setOpen] = useState({ revenue: true, costs: true, depreciation: true, memo: true })
  const toggle = (k) => setOpen(s => ({ ...s, [k]: !s[k] }))

  const years = useMemo(() => {
    const set = new Set([currentYear, currentYear - 1, currentYear - 2])
    ;(invoices || []).forEach(i => {
      const d = i.issueDate || i.date
      if (d) set.add(new Date(d).getFullYear())
    })
    ;(expenses || []).forEach(e => e.date && set.add(new Date(e.date).getFullYear()))
    return [...set].sort((a, b) => b - a)
  }, [invoices, expenses, currentYear])

  const paidInvoices = useMemo(() =>
    (invoices || []).filter(i => {
      const d = i.issueDate || i.date
      return i.status === 'paid' && d && new Date(d).getFullYear() === year
    }),
    [invoices, year])

  const processedExpenses = useMemo(() =>
    (expenses || []).filter(e => e.status === 'processed' && e.date && new Date(e.date).getFullYear() === year),
    [expenses, year])

  const yearEntries = useMemo(() =>
    (entries || []).filter(e => e.date && new Date(e.date).getFullYear() === year),
    [entries, year])

  const totalRevenue = useMemo(() => paidInvoices.reduce((s, i) => s + invoiceExBtw(i.items), 0), [paidInvoices])
  const totalCosts = useMemo(() => processedExpenses.reduce((s, e) => s + Number(e.amount || 0), 0), [processedExpenses])
  const totalDepreciation = useMemo(() => getDepreciationForYear(assets, year), [assets, year])
  const memoResult = useMemo(() => yearEntries.reduce((s, e) =>
    s + (e.type === 'credit' ? Number(e.amount || 0) : -Number(e.amount || 0)), 0), [yearEntries])

  const brutomarge = totalRevenue - totalCosts
  const result = brutomarge - totalDepreciation + memoResult

  const SectionHeader = ({ label, value, sectionKey, color }) => (
    <button onClick={() => toggle(sectionKey)} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      width: '100%', padding: '10px 16px', background: 'var(--surface-2)',
      border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {open[sectionKey] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {label}
      </span>
      <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '700', color }}>{fmtEUR(value)}</span>
    </button>
  )

  const SubRow = ({ label, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 16px 7px 32px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: '12px', color }}>{fmtEUR(value)}</span>
    </div>
  )

  const TotalRow = ({ label, value, color, large }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: large ? '14px 16px' : '10px 16px', borderTop: '1px solid var(--border)', background: large ? (result >= 0 ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)') : 'transparent' }}>
      <span style={{ fontSize: large ? '15px' : '13px', fontWeight: '700', color: color || 'var(--text)' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: large ? '20px' : '14px', fontWeight: '800', color: color || 'var(--text)' }}>{fmtEUR(value)}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Boekjaar:</span>
          <select style={{ ...inp, width: 'auto', padding: '6px 12px' }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { label: 'Omzet', value: totalRevenue, color: 'var(--success)' },
            { label: 'Kosten', value: totalCosts, color: 'var(--danger)' },
            { label: 'Resultaat', value: result, color: result >= 0 ? 'var(--success)' : 'var(--danger)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', textAlign: 'right' }}>
              <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: '3px' }}>{s.label}</div>
              <div style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '15px', color: s.color }}>{fmtEUR(s.value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* P&L statement */}
      <Card>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: '600', color: 'var(--text)', fontSize: '14px' }}>Winst- en Verliesrekening {year}</span>
        </div>

        {/* Revenue */}
        <SectionHeader label="Omzet (excl. BTW)" value={totalRevenue} sectionKey="revenue" color="var(--success)" />
        {open.revenue && (
          <>
            {paidInvoices.length === 0
              ? <div style={{ padding: '10px 32px', fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', borderBottom: '1px solid var(--border)' }}>Geen betaalde facturen in {year}</div>
              : paidInvoices.map(inv => {
                const clientName = (clients || []).find(c => c.id === inv.clientId)?.name || inv.clientName || '—'
                return <SubRow key={inv.id} label={`${inv.number || inv.id} — ${clientName}`} value={invoiceExBtw(inv.items)} color="var(--success)" />
              })
            }
            <TotalRow label="Totaal omzet" value={totalRevenue} color="var(--success)" />
          </>
        )}

        {/* Costs */}
        <SectionHeader label="Bedrijfskosten" value={totalCosts} sectionKey="costs" color="var(--danger)" />
        {open.costs && (
          <>
            {processedExpenses.length === 0
              ? <div style={{ padding: '10px 32px', fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', borderBottom: '1px solid var(--border)' }}>Geen verwerkte bonnen in {year}</div>
              : processedExpenses.map(exp => (
                <SubRow key={exp.id} label={`${exp.vendor || '—'}${exp.category ? ` (${exp.category})` : ''}`} value={exp.amount} color="var(--danger)" />
              ))
            }
            <TotalRow label="Totaal kosten" value={totalCosts} color="var(--danger)" />
            <TotalRow label="Brutomarge" value={brutomarge} color={brutomarge >= 0 ? 'var(--text)' : 'var(--danger)'} />
          </>
        )}

        {/* Depreciation */}
        <SectionHeader label="Afschrijvingen" value={totalDepreciation} sectionKey="depreciation" color="var(--warning)" />
        {open.depreciation && (
          <>
            {(assets || []).filter(a => a.is_active !== false).length === 0
              ? <div style={{ padding: '10px 32px', fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', borderBottom: '1px solid var(--border)' }}>Geen activa geregistreerd</div>
              : (assets || []).filter(a => a.is_active !== false).map(asset => {
                const { schedule } = computeAsset(asset)
                const entry = schedule.find(s => s.year === year)
                if (!entry) return null
                return <SubRow key={asset.id} label={`${asset.name} (${asset.category})`} value={entry.depreciation} color="var(--warning)" />
              })
            }
            {totalDepreciation > 0 && <TotalRow label="Totaal afschrijvingen" value={totalDepreciation} color="var(--warning)" />}
          </>
        )}

        {/* Memo entries */}
        {yearEntries.length > 0 && (
          <>
            <SectionHeader label="Memoriaalboekingen" value={memoResult} sectionKey="memo" color={memoResult >= 0 ? 'var(--success)' : 'var(--danger)'} />
            {open.memo && yearEntries.map(e => (
              <SubRow key={e.id}
                label={`${e.description} (${e.category})`}
                value={Math.abs(e.amount)}
                color={e.type === 'credit' ? 'var(--success)' : 'var(--danger)'}
              />
            ))}
          </>
        )}

        {/* Net result */}
        <TotalRow
          label={result >= 0 ? `Nettowinst ${year}` : `Nettoverlies ${year}`}
          value={Math.abs(result)}
          color={result >= 0 ? 'var(--success)' : 'var(--danger)'}
          large
        />
      </Card>
    </div>
  )
}

// ── Vaste Activa tab ──────────────────────────────────────────────────────────
function VasteActivaTab({ assets, setAssets }) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [form, setForm] = useState({
    name: '', category: 'Hardware',
    purchase_date: todayISO(), purchase_value: '',
    residual_value: '0', depreciation_years: '5', notes: '',
  })

  const resetForm = () => setForm({ name: '', category: 'Hardware', purchase_date: todayISO(), purchase_value: '', residual_value: '0', depreciation_years: '5', notes: '' })

  const handleSave = () => {
    if (!form.name.trim() || !form.purchase_value) return
    if (editId) {
      setAssets(prev => prev.map(a => a.id === editId ? { ...a, ...form } : a))
      setEditId(null)
    } else {
      setAssets(prev => [{ id: genId(), is_active: true, ...form }, ...(prev || [])])
    }
    resetForm()
    setShowForm(false)
  }

  const handleEdit = (asset) => {
    setEditId(asset.id)
    setForm({ name: asset.name, category: asset.category, purchase_date: asset.purchase_date, purchase_value: asset.purchase_value, residual_value: asset.residual_value, depreciation_years: asset.depreciation_years, notes: asset.notes || '' })
    setShowForm(true)
  }

  const handleDeactivate = (id) => {
    if (!confirm('Activum afboeken? Het wordt niet meer meegenomen in afschrijvingen.')) return
    setAssets(prev => prev.map(a => a.id === id ? { ...a, is_active: false } : a))
  }

  const activeAssets = (assets || []).filter(a => a.is_active !== false)
  const inactiveAssets = (assets || []).filter(a => a.is_active === false)
  const currentYear = new Date().getFullYear()

  const catIcon = (cat) => {
    if (cat === 'Auto') return Car
    if (cat === 'Hardware') return Monitor
    if (cat === 'Meubilair' || cat === 'Inventaris') return Building2
    return Package
  }

  const annualPreview = form.purchase_value
    ? (parseFloat(form.purchase_value) - parseFloat(form.residual_value || 0)) / parseInt(form.depreciation_years || 1)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{activeAssets.length} activa geregistreerd</span>
          {inactiveAssets.length > 0 && (
            <button onClick={() => setShowInactive(v => !v)} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
              {showInactive ? 'Verberg' : 'Toon'} {inactiveAssets.length} afgeboekt
            </button>
          )}
        </div>
        <button
          onClick={() => { setEditId(null); resetForm(); setShowForm(v => !v) }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
        >
          <Plus size={14} /> Activum toevoegen
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <Card style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
            {editId ? 'Activum bewerken' : 'Nieuw activum inboeken'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Naam</Label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="bijv. MacBook Pro, Tesla Model 3, Bureau" />
            </div>
            <div>
              <Label>Categorie</Label>
              <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Aanschafdatum</Label>
              <input type="date" style={inp} value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div>
              <Label>Aanschafwaarde (€)</Label>
              <input type="number" style={inp} value={form.purchase_value} onChange={e => setForm(f => ({ ...f, purchase_value: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
            </div>
            <div>
              <Label>Restwaarde (€)</Label>
              <input type="number" style={inp} value={form.residual_value} onChange={e => setForm(f => ({ ...f, residual_value: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
            </div>
            <div>
              <Label>Afschrijvingstermijn</Label>
              <select style={inp} value={form.depreciation_years} onChange={e => setForm(f => ({ ...f, depreciation_years: e.target.value }))}>
                {[1,2,3,4,5,6,7,8,9,10].map(y => <option key={y} value={y}>{y} jaar</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Notities (optioneel)</Label>
              <input style={inp} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Kenteken, serienummer, etc." />
            </div>
          </div>
          {annualPreview !== null && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--accent-soft)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-2)' }}>
              Lineaire afschrijving: <strong style={{ color: 'var(--accent)' }}>{fmtEUR(annualPreview)}</strong> per jaar over {form.depreciation_years} jaar
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={handleSave} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '9px 18px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              {editId ? 'Opslaan' : 'Inboeken'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); resetForm() }} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 14px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>
              Annuleren
            </button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {activeAssets.length === 0 && !showForm && (
        <Card style={{ padding: '48px', textAlign: 'center' }}>
          <Package size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px', display: 'block' }} />
          <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Nog geen activa ingeboekt. Voeg een auto, hardware of andere investering toe.</div>
        </Card>
      )}

      {/* Active assets */}
      {activeAssets.map(asset => {
        const c = computeAsset(asset)
        const CatIcon = catIcon(asset.category)
        const isExpanded = expandedId === asset.id
        return (
          <Card key={asset.id}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CatIcon size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text)' }}>{asset.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                    {asset.category} · {fmtDate(asset.purchase_date)} · {asset.depreciation_years}j afschrijving
                  </div>
                  {asset.notes && <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{asset.notes}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '2px' }}>Boekwaarde nu</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '16px', color: c.isFullyDepreciated ? 'var(--text-3)' : 'var(--accent)' }}>
                    {fmtEUR(c.currentBookValue)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '2px' }}>Per jaar</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--warning)', fontWeight: '600' }}>{fmtEUR(c.annualDep)}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : asset.id)}
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', color: 'var(--text-3)', fontSize: '12px', cursor: 'pointer' }}>
                    {isExpanded ? 'Inklappen' : 'Schema'}
                  </button>
                  <button onClick={() => handleEdit(asset)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '5px', display: 'flex' }}>
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDeactivate(asset.id)} title="Afboeken"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '5px', display: 'flex' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Depreciation schedule */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Jaar', 'Beginwaarde', 'Afschrijving', 'Eindwaarde', 'Status'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.schedule.map((row, i) => {
                      const isPast = row.year < currentYear
                      const isCurrent = row.year === currentYear
                      return (
                        <tr key={i} style={{ background: isCurrent ? 'var(--accent-soft)' : 'transparent' }}>
                          <td style={td}><strong style={{ color: isCurrent ? 'var(--accent)' : 'inherit' }}>{row.year}</strong></td>
                          <td style={{ ...td, fontFamily: 'monospace' }}>{fmtEUR(row.startValue)}</td>
                          <td style={{ ...td, fontFamily: 'monospace', color: 'var(--warning)' }}>{fmtEUR(row.depreciation)}</td>
                          <td style={{ ...td, fontFamily: 'monospace' }}>{fmtEUR(row.endValue)}</td>
                          <td style={td}>
                            {isCurrent
                              ? <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '600' }}>Huidig jaar</span>
                              : isPast
                                ? <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>Afgeschreven</span>
                                : <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>Gepland</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )
      })}

      {/* Inactive assets */}
      {showInactive && inactiveAssets.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', margin: '8px 0', padding: '0 4px' }}>
            Afgeboekte activa
          </div>
          {inactiveAssets.map(asset => (
            <Card key={asset.id} style={{ marginBottom: '8px', opacity: 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-2)' }}>{asset.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{asset.category} · aangeschaft {fmtDate(asset.purchase_date)}</div>
                </div>
                <button
                  onClick={() => setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_active: true } : a))}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', color: 'var(--text-3)', fontSize: '12px', cursor: 'pointer' }}
                >
                  <RotateCcw size={12} /> Terugboeken
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Memoriaal tab ─────────────────────────────────────────────────────────────
function MemoriaalTab({ entries, setEntries }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: todayISO(), description: '', amount: '', type: 'debet', category: 'Correctie' })

  const handleAdd = () => {
    if (!form.description.trim() || !form.amount) return
    setEntries(prev => [{ id: genId(), ...form, created_at: new Date().toISOString(), is_reversal: false }, ...(prev || [])])
    setForm({ date: todayISO(), description: '', amount: '', type: 'debet', category: 'Correctie' })
    setShowForm(false)
  }

  const handleReverse = (entry) => {
    const reversal = {
      id: genId(),
      date: todayISO(),
      description: `Terugboeking: ${entry.description}`,
      amount: entry.amount,
      type: entry.type === 'credit' ? 'debet' : 'credit',
      category: 'Terugboeking',
      created_at: new Date().toISOString(),
      is_reversal: true,
      reversal_of: entry.id,
    }
    setEntries(prev => [reversal, ...(prev || [])])
  }

  const handleDelete = (id) => {
    if (!confirm('Boeking verwijderen?')) return
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const totalResult = (entries || []).reduce((s, e) =>
    s + (e.type === 'credit' ? Number(e.amount || 0) : -Number(e.amount || 0)), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>
          Nettosaldo boekingen:{' '}
          <strong style={{ color: totalResult >= 0 ? 'var(--success)' : 'var(--danger)', fontFamily: 'monospace' }}>
            {fmtEUR(totalResult)}
          </strong>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
          <Plus size={14} /> Boeking toevoegen
        </button>
      </div>

      {showForm && (
        <Card style={{ padding: '18px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Nieuwe memoriaalpost</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <Label>Datum</Label>
              <input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Categorie</Label>
              <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {ENTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Omschrijving</Label>
              <input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="bijv. Restverschil kas Q4, Correctie dubbele bon, Privéonttrekking" />
            </div>
            <div>
              <Label>Bedrag (€)</Label>
              <input type="number" style={inp} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
            </div>
            <div>
              <Label>Boekingsrichting</Label>
              <select style={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="credit">Credit (+) — opbrengst of opwaartse correctie</option>
                <option value="debet">Debet (−) — kosten of neerwaartse correctie</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button onClick={handleAdd} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '9px 18px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Boeken</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 14px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>Annuleren</button>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Datum', 'Omschrijving', 'Categorie', 'Type', 'Bedrag', 'Acties'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(entries || []).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text-3)', padding: '40px' }}>
                    Nog geen memoriaalboekingen. Gebruik dit voor correcties, restverschillen en terugboekingen.
                  </td>
                </tr>
              ) : (entries || []).map(e => (
                <tr key={e.id} style={{ opacity: e.is_reversal ? 0.75 : 1 }}>
                  <td style={td}><span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{fmtDate(e.date)}</span></td>
                  <td style={td}>
                    {e.description}
                    {e.is_reversal && (
                      <span style={{ marginLeft: '8px', fontSize: '10px', background: 'var(--warning-soft)', color: 'var(--warning)', padding: '1px 6px', borderRadius: '8px' }}>Terugboeking</span>
                    )}
                  </td>
                  <td style={td}><span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{e.category}</span></td>
                  <td style={td}>
                    <span style={{
                      fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '8px',
                      background: e.type === 'credit' ? 'var(--success-soft)' : 'var(--danger-soft)',
                      color: e.type === 'credit' ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {e.type === 'credit' ? 'Credit' : 'Debet'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: e.type === 'credit' ? 'var(--success)' : 'var(--danger)' }}>
                      {e.type === 'credit' ? '+' : '−'}{fmtEUR(e.amount)}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {!e.is_reversal && (
                        <button onClick={() => handleReverse(e)} title="Maak een tegengestelde boeking aan"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--warning-soft)', border: 'none', borderRadius: '6px', padding: '4px 9px', color: 'var(--warning)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                          <RotateCcw size={11} /> Terugboeken
                        </button>
                      )}
                      <button onClick={() => handleDelete(e.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', display: 'flex' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function BoekhoudenView({ invoices, expenses, assets, setAssets, entries, setEntries, clients }) {
  const [tab, setTab] = useState('wv')
  const tabs = [
    { id: 'wv', label: 'Winst/Verlies' },
    { id: 'activa', label: 'Vaste Activa' },
    { id: 'memoriaal', label: 'Memoriaal' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Boekhouding</h1>
        <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>Winst/verlies, vaste activa & memoriaalboekingen</p>
      </div>

      <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px', marginBottom: '20px', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '7px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px',
              fontWeight: tab === t.id ? '600' : '500',
              background: tab === t.id ? 'var(--surface)' : 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-3)',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.12s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'wv' && <WinstVerliesTab invoices={invoices} expenses={expenses} assets={assets} entries={entries} clients={clients} />}
      {tab === 'activa' && <VasteActivaTab assets={assets} setAssets={setAssets} />}
      {tab === 'memoriaal' && <MemoriaalTab entries={entries} setEntries={setEntries} />}
    </div>
  )
}
