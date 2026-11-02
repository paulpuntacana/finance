import { useState, useMemo } from 'react'
import { useLang } from './LangContext'
import { computeInvoice, isRevenueInvoice, isCountedExpense, expenseNet, entrySignedAmount as coreEntrySignedAmount, invoiceOpenAmount, invoiceDate, buildVatReturn, todayISO } from './finance'
import { Button, Card, Segmented, Money } from './ui'
import {
  Plus, Trash2, Edit3, TrendingUp, RotateCcw,
  ChevronDown, ChevronRight, Car, Monitor, Building2, Package,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────
const ASSET_CATEGORIES = ['Auto', 'Hardware', 'Meubilair', 'Machine', 'Inventaris', 'Software', 'Overig']
const ENTRY_CATEGORIES = ['Correctie', 'Restverschil', 'Terugboeking', 'Extra afschrijving', 'Omzetaanpassing', 'Kostenpost', 'Overig']

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const genId = () => `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

// ── Afschrijving: één regel voor W&V, activa-overzicht én balans ──────────────
// Lineair, hele jaren: het aanschafjaar telt als volledig eerste afschrijvingsjaar.
// Boekwaarde "ultimo jaar J" = aanschafwaarde − alle afschrijvingen t/m J (dus eind aanschafjaar al verlaagd).
// Afgeboekte activa (is_active === false) schrijven af t/m het jaar vóór `deactivatedAt`; in en na
// het afboekjaar niet meer. Oude afgeboekte activa zonder `deactivatedAt` tellen (zoals voorheen) niet mee.
const yearOfISO = (iso) => (iso ? Number(String(iso).slice(0, 4)) : null)
const currentYearNow = () => Number(todayISO().slice(0, 4))

const assetBasics = (asset) => {
  const purchaseValue = parseFloat(asset.purchase_value) || 0
  const residualValue = parseFloat(asset.residual_value) || 0
  const years = parseInt(asset.depreciation_years) || 1
  const annualDep = years > 0 ? (purchaseValue - residualValue) / years : 0
  const purchaseYear = yearOfISO(asset.purchase_date) || currentYearNow()
  // Eerste jaar waarin het activum NIET meer afschrijft door afboeking (null = nooit afgeboekt)
  const stopYear = asset.is_active === false ? (yearOfISO(asset.deactivatedAt) ?? -Infinity) : null
  return { purchaseValue, residualValue, years, annualDep, purchaseYear, stopYear }
}

const assetDepreciationInYear = (asset, year) => {
  const b = assetBasics(asset)
  if (year < b.purchaseYear || year >= b.purchaseYear + b.years) return 0
  if (b.stopYear !== null && year >= b.stopYear) return 0
  return b.annualDep
}

// Boekwaarde na afschrijving van jaar `year` (null als het activum dan al is afgeboekt)
const assetBookValueEndOf = (asset, year) => {
  const b = assetBasics(asset)
  if (year < b.purchaseYear) return null
  if (b.stopYear !== null && year >= b.stopYear) return null
  const elapsed = Math.min(b.years, year - b.purchaseYear + 1)
  return Math.max(b.residualValue, b.purchaseValue - b.annualDep * elapsed)
}

// Boekwaarde voor de balans: aanschafwaarde − som van de afschrijvingen die in de W&V t/m `year`
// zijn genomen. Zo sluiten balans en W&V altijd op elkaar aan (ook in het afboekjaar).
const assetBookValueForBalance = (asset, year) => {
  const b = assetBasics(asset)
  let dep = 0
  for (let y = b.purchaseYear; y <= year; y++) dep += assetDepreciationInYear(asset, y)
  return Math.max(b.residualValue, b.purchaseValue - dep)
}

// Depreciation schedule for an asset (linear method) — zelfde regel als hierboven
const computeAsset = (asset) => {
  const b = assetBasics(asset)
  const schedule = Array.from({ length: b.years }, (_, y) => {
    const startValue = b.purchaseValue - b.annualDep * y
    const endValue = Math.max(b.residualValue, startValue - b.annualDep)
    const year = b.purchaseYear + y
    return { year, depreciation: assetDepreciationInYear(asset, year), startValue, endValue, stopped: b.stopYear !== null && year >= b.stopYear }
  })
  const currentYear = currentYearNow()
  const yearsElapsed = Math.max(0, Math.min(b.years, currentYear - b.purchaseYear + 1))
  const bv = assetBookValueEndOf(asset, currentYear)
  const currentBookValue = bv === null ? (currentYear < b.purchaseYear ? b.purchaseValue : 0) : bv
  const isFullyDepreciated = currentYear >= b.purchaseYear + b.years - 1

  return { annualDep: b.annualDep, schedule, currentBookValue, yearsElapsed, isFullyDepreciated }
}

const getDepreciationForYear = (assets, year) =>
  (assets || []).reduce((sum, asset) => sum + assetDepreciationInYear(asset, year), 0)

// Memoriaalboekingen gebruiken `type: 'credit'|'debet'`, maar journaalposten die vanuit de bank
// geboekt worden (BankView) gebruiken `isDebit: boolean` zonder `type`. Deze helper ondersteunt beide
// zodat bank-journaalposten correct meetellen i.p.v. altijd als debet behandeld te worden.
const entrySignedAmount = coreEntrySignedAmount
const entryIsCredit = (e) => e.type ? e.type === 'credit' : !e.isDebit

// Journaalposten/kostenposten die vanuit Bank geboekt zijn slaan de ruwe bank-omschrijving op
// als "Bank: <tekst>" in notes/reference. Strip dat voorvoegsel zodat je alleen de omschrijving zelf ziet.
const stripBankPrefix = (text) => (text || '').replace(/^Bank:\s*/i, '').trim()

// Zoekt de naam van een grootboekrekening op code (bv. "4420" → "Data, AI & API-diensten").
const ledgerLabel = (ledgerAccounts, code) => (ledgerAccounts || []).find(a => a.code === code)?.name || null

// Factuur excl. BTW — via finance-kern (creditnota's tellen negatief mee)
const invoiceExBtw = (items = []) => computeInvoice(items).subtotal

// ── Shared UI primitives ──────────────────────────────────────────────────────
const inp = {
  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
  borderRadius: '8px', color: 'var(--text)', padding: '9px 12px',
  fontSize: '13px', width: '100%', outline: 'none', boxSizing: 'border-box',
}
// Tabellen gebruiken .ledger (index.css); th/td blijven voor incidentele overrides
const th = {}
const td = {}

const Label = ({ children }) => (
  <div style={{ color: 'var(--text-2)', fontSize: '12.5px', fontWeight: '500', marginBottom: '5px' }}>
    {children}
  </div>
)

// Jaartallen waarin iets geboekt is (+ huidig en twee vorige jaren)
const collectYears = (...lists) => {
  const cy = currentYearNow()
  const set = new Set([cy, cy - 1, cy - 2])
  lists.forEach(list => (list || []).forEach(x => { const y = yearOfISO(x?.issueDate || x?.date); if (y) set.add(y) }))
  return [...set].sort((a, b) => b - a)
}

// ── Winst/Verlies tab ─────────────────────────────────────────────────────────
function WinstVerliesTab({ invoices, expenses, assets, entries, clients, ledgerAccounts }) {
  const { t } = useLang()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [open, setOpen] = useState({ revenue: true, costs: true, depreciation: true, memo: true })
  const toggle = (k) => setOpen(s => ({ ...s, [k]: !s[k] }))

  const years = useMemo(() => collectYears(invoices, expenses, entries), [invoices, expenses, entries])

  const paidInvoices = useMemo(() =>
    (invoices || []).filter(i => {
      const d = i.issueDate || i.date
      // Factuurstelsel: alle verstuurde facturen + creditnota's tellen als omzet op factuurdatum
      return isRevenueInvoice(i) && d && new Date(d).getFullYear() === year
    }),
    [invoices, year])

  const processedExpenses = useMemo(() =>
    (expenses || []).filter(e => isCountedExpense(e) && e.date && new Date(e.date).getFullYear() === year),
    [expenses, year])

  const yearEntries = useMemo(() =>
    (entries || []).filter(e => e.date && new Date(e.date).getFullYear() === year),
    [entries, year])

  const totalRevenue = useMemo(() => paidInvoices.reduce((s, i) => s + invoiceExBtw(i.items), 0), [paidInvoices])
  // Kosten excl. aftrekbare BTW (omzet is ook excl. BTW)
  const totalCosts = useMemo(() => processedExpenses.reduce((s, e) => s + expenseNet(e), 0), [processedExpenses])
  const totalDepreciation = useMemo(() => getDepreciationForYear(assets, year), [assets, year])
  const memoResult = useMemo(() => yearEntries.reduce((s, e) => s + entrySignedAmount(e), 0), [yearEntries])

  const brutomarge = totalRevenue - totalCosts
  const result = brutomarge - totalDepreciation + memoResult

  const SectionHeader = ({ label, value, sectionKey, color }) => (
    <button onClick={() => toggle(sectionKey)} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      width: '100%', padding: '10px 16px', background: 'var(--surface-2)',
      border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '600', color: 'var(--text-2)' }}>
        {open[sectionKey] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {label}
      </span>
      <Money value={value} style={{ fontSize: '13px', fontWeight: 600, color }} />
    </button>
  )

  const SubRow = ({ label, subLabel, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 16px 7px 32px', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{label}</div>
        {subLabel && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{subLabel}</div>}
      </div>
      <Money value={value} style={{ fontSize: '12.5px', color, flexShrink: 0, marginLeft: '12px' }} />
    </div>
  )

  const TotalRow = ({ label, value, color, large }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: large ? '14px 16px' : '10px 16px', borderTop: '1px solid var(--border)', background: large ? (result >= 0 ? 'var(--success-soft)' : 'var(--danger-soft)') : 'transparent' }}>
      <span style={{ fontSize: large ? '15px' : '13px', fontWeight: '650', color: color || 'var(--text)' }}>{label}</span>
      <Money value={value} style={{ fontSize: large ? '20px' : '14px', fontWeight: 650, color: color || 'var(--text)' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{t('bk.fiscalYear')}:</span>
          <select style={{ ...inp, width: 'auto', padding: '6px 12px' }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: t('bk.revenueLabel'), value: totalRevenue, color: 'var(--success)' },
            { label: t('bk.costsLabel'), value: totalCosts, color: 'var(--danger)' },
            { label: t('bk.resultLabel'), value: result, color: result >= 0 ? 'var(--success)' : 'var(--danger)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-3)', marginBottom: '3px' }}>{s.label}</div>
              <Money value={s.value} style={{ fontWeight: 650, fontSize: '15px', color: s.color }} />
            </div>
          ))}
        </div>
      </div>

      {/* P&L statement */}
      <Card>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: '600', color: 'var(--text)', fontSize: '14px' }}>{t('bk.plTitle')} {year}</span>
        </div>

        {/* Revenue */}
        <SectionHeader label={t('bk.revenue')} value={totalRevenue} sectionKey="revenue" color="var(--success)" />
        {open.revenue && (
          <>
            {paidInvoices.length === 0
              ? <div style={{ padding: '10px 32px', fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', borderBottom: '1px solid var(--border)' }}>Geen verstuurde facturen in {year}</div>
              : paidInvoices.map(inv => {
                const clientName = (clients || []).find(c => c.id === inv.clientId)?.name || inv.clientName || '—'
                return <SubRow key={inv.id} label={`${inv.number || inv.id} — ${clientName}`} value={invoiceExBtw(inv.items)} color="var(--success)" />
              })
            }
            <TotalRow label={t('bk.totalRevenue')} value={totalRevenue} color="var(--success)" />
          </>
        )}

        {/* Costs */}
        <SectionHeader label={t('bk.costs')} value={totalCosts} sectionKey="costs" color="var(--danger)" />
        {open.costs && (
          <>
            {processedExpenses.length === 0
              ? <div style={{ padding: '10px 32px', fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', borderBottom: '1px solid var(--border)' }}>Geen verwerkte bonnen in {year}</div>
              : processedExpenses.map(exp => {
                const bankText = stripBankPrefix(exp.notes)
                const vendor = exp.vendor || bankText || 'Onbekende leverancier'
                const ledger = exp.ledgerAccount
                  ? `${exp.ledgerAccount}${ledgerLabel(ledgerAccounts, exp.ledgerAccount) ? ' · ' + ledgerLabel(ledgerAccounts, exp.ledgerAccount) : ''}`
                  : null
                const subLabel = [
                  exp.category || null,
                  ledger,
                  bankText && bankText !== vendor ? bankText : null,
                ].filter(Boolean).join(' · ')
                return <SubRow key={exp.id} label={vendor} subLabel={subLabel} value={expenseNet(exp)} color="var(--danger)" />
              })
            }
            <TotalRow label={t('bk.totalCosts')} value={totalCosts} color="var(--danger)" />
            <TotalRow label={t('bk.grossMargin')} value={brutomarge} color={brutomarge >= 0 ? 'var(--text)' : 'var(--danger)'} />
          </>
        )}

        {/* Depreciation */}
        <SectionHeader label={t('bk.depreciation')} value={totalDepreciation} sectionKey="depreciation" color="var(--warning)" />
        {open.depreciation && (
          <>
            {(assets || []).filter(a => assetDepreciationInYear(a, year) > 0).length === 0
              ? <div style={{ padding: '10px 32px', fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', borderBottom: '1px solid var(--border)' }}>{t('bk.noAssets')}</div>
              : (assets || []).filter(a => assetDepreciationInYear(a, year) > 0).map(asset => (
                <SubRow key={asset.id} label={`${asset.name} (${asset.category})`} subLabel={asset.is_active === false ? `Afgeboekt ${fmtDate(asset.deactivatedAt)}` : null} value={assetDepreciationInYear(asset, year)} color="var(--warning)" />
              ))
            }
            {totalDepreciation > 0 && <TotalRow label="Totaal afschrijvingen" value={totalDepreciation} color="var(--warning)" />}
          </>
        )}

        {/* Memo entries */}
        {yearEntries.length > 0 && (
          <>
            <SectionHeader label="Memoriaalboekingen" value={memoResult} sectionKey="memo" color={memoResult >= 0 ? 'var(--success)' : 'var(--danger)'} />
            {open.memo && yearEntries.map(e => {
              const bankText = stripBankPrefix(e.reference)
              const title = e.description || bankText || 'Journaalpost'
              const ledger = e.ledgerCode
                ? `${e.ledgerCode}${ledgerLabel(ledgerAccounts, e.ledgerCode) ? ' · ' + ledgerLabel(ledgerAccounts, e.ledgerCode) : ''}`
                : null
              const subLabel = [
                e.category || null,
                ledger,
                bankText && bankText !== title ? bankText : null,
              ].filter(Boolean).join(' · ')
              return (
                <SubRow key={e.id}
                  label={title}
                  subLabel={subLabel}
                  value={Math.abs(e.amount)}
                  color={entryIsCredit(e) ? 'var(--success)' : 'var(--danger)'}
                />
              )
            })}
          </>
        )}

        {/* Net result */}
        <TotalRow
          label={`${result >= 0 ? t('bk.netProfit') : t('bk.netLoss')} ${year}`}
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
  const { t } = useLang()
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

  // Afboeken legt de datum vast: afschrijving t/m het jaar ervoor blijft in de W&V staan
  const handleDeactivate = (id) => {
    const date = window.prompt('Activum afboeken per datum (JJJJ-MM-DD). Vanaf dat jaar wordt niet meer afgeschreven; eerdere jaren blijven staan.', todayISO())
    if (!date) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) { alert('Ongeldige datum, gebruik JJJJ-MM-DD.'); return }
    setAssets(prev => prev.map(a => a.id === id ? { ...a, is_active: false, deactivatedAt: date.trim() } : a))
  }

  const activeAssets = (assets || []).filter(a => a.is_active !== false)
  const inactiveAssets = (assets || []).filter(a => a.is_active === false)
  const currentYear = currentYearNow()

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
        <Button onClick={() => { setEditId(null); resetForm(); setShowForm(v => !v) }}>
          <Plus size={14} /> {t('bk.addAsset')}
        </Button>
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
              Lineaire afschrijving: <strong style={{ color: 'var(--accent)' }}><Money value={annualPreview} /></strong> per jaar over {form.depreciation_years} jaar, het aanschafjaar telt als eerste volle jaar
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <Button onClick={handleSave}>{editId ? 'Opslaan' : 'Inboeken'}</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditId(null); resetForm() }}>Annuleren</Button>
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
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '2px' }}>Boekwaarde ultimo {currentYear}</div>
                  <Money value={c.currentBookValue} style={{ fontWeight: 650, fontSize: '16px', color: c.isFullyDepreciated ? 'var(--text-3)' : 'var(--accent)' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '2px' }}>Per jaar</div>
                  <Money value={c.annualDep} style={{ fontSize: '14px', color: 'var(--warning)', fontWeight: 600 }} />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button size="sm" variant="secondary" onClick={() => setExpandedId(isExpanded ? null : asset.id)}>
                    {isExpanded ? 'Inklappen' : 'Schema'}
                  </Button>
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
                <table className="ledger">
                  <thead>
                    <tr>
                      {['Jaar', 'Beginwaarde', 'Afschrijving', 'Eindwaarde', 'Status'].map((h, hi) => (
                        <th key={h} className={hi >= 1 && hi <= 3 ? 'r' : ''}>{h}</th>
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
                          <td className="r"><Money value={row.startValue} /></td>
                          <td className="r"><Money value={row.depreciation} style={{ color: 'var(--warning)' }} /></td>
                          <td className="r"><Money value={row.endValue} /></td>
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
          <div style={{ fontSize: '12.5px', fontWeight: '500', color: 'var(--text-3)', margin: '8px 0', padding: '0 4px' }}>
            Afgeboekte activa
          </div>
          {inactiveAssets.map(asset => (
            <Card key={asset.id} style={{ marginBottom: '8px', opacity: 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-2)' }}>{asset.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{asset.category} · aangeschaft {fmtDate(asset.purchase_date)}{asset.deactivatedAt ? ` · afgeboekt ${fmtDate(asset.deactivatedAt)}` : ''}</div>
                </div>
                <Button size="sm" variant="secondary"
                  onClick={() => setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_active: true, deactivatedAt: null } : a))}
                >
                  <RotateCcw size={12} /> Terugboeken
                </Button>
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
  const { t } = useLang()
  const [year, setYear] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: todayISO(), description: '', amount: '', type: 'debet', category: 'Correctie' })

  const handleAdd = () => {
    if (!form.description.trim() || !form.amount) return
    setEntries(prev => [{ id: genId(), ...form, created_at: new Date().toISOString(), is_reversal: false }, ...(prev || [])])
    setForm({ date: todayISO(), description: '', amount: '', type: 'debet', category: 'Correctie' })
    setShowForm(false)
  }

  // Al teruggeboekt? (vlag op het origineel, of er bestaat al een terugboeking die ernaar verwijst)
  const isReversed = (entry) => !!entry.reversedBy || (entries || []).some(x => x.reversal_of === entry.id)

  const handleReverse = (entry) => {
    if (entry.is_reversal || isReversed(entry)) return
    const reversalId = genId()
    const reversal = {
      id: reversalId,
      date: todayISO(),
      description: `Terugboeking: ${entry.description}`,
      amount: entry.amount,
      type: entryIsCredit(entry) ? 'debet' : 'credit',
      category: 'Terugboeking',
      created_at: new Date().toISOString(),
      is_reversal: true,
      reversal_of: entry.id,
    }
    setEntries(prev => {
      const list = prev || []
      // Dubbelklik/gelijktijdige klik: nogmaals checken op de actuele lijst
      if (list.some(x => x.reversal_of === entry.id || (x.id === entry.id && x.reversedBy))) return list
      return [reversal, ...list.map(x => x.id === entry.id ? { ...x, reversedBy: reversalId } : x)]
    })
  }

  const handleDelete = (id) => {
    if (!confirm('Boeking verwijderen?')) return
    // Terugboeking verwijderd → origineel is weer terug te boeken
    setEntries(prev => prev.filter(e => e.id !== id).map(e => e.reversedBy === id ? { ...e, reversedBy: null } : e))
  }

  const years = useMemo(() => collectYears(entries), [entries])
  const shown = useMemo(() => {
    const list = year === 'all' ? (entries || []) : (entries || []).filter(e => yearOfISO(e.date) === year)
    return [...list].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [entries, year])
  const totals = useMemo(() => {
    let credit = 0, debet = 0
    shown.forEach(e => { const v = entrySignedAmount(e); if (v >= 0) credit += v; else debet += -v })
    return { credit, debet, net: credit - debet }
  }, [shown])
  const totalResult = totals.net

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <Segmented
          value={year}
          onChange={setYear}
          options={[{ id: 'all', label: 'Alle jaren' }, ...years.map(y => ({ id: y, label: String(y), count: (entries || []).filter(e => yearOfISO(e.date) === y).length }))]}
        />
        <Button onClick={() => setShowForm(v => !v)}>
          <Plus size={14} /> {t('bk.addEntry')}
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {[
          { label: `Credit (+)${year === 'all' ? '' : ' ' + year}`, value: totals.credit, color: 'var(--success)' },
          { label: `Debet (−)${year === 'all' ? '' : ' ' + year}`, value: -totals.debet, color: 'var(--danger)' },
          { label: `Nettosaldo${year === 'all' ? '' : ' ' + year}`, value: totalResult, color: totalResult >= 0 ? 'var(--success)' : 'var(--danger)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-3)', marginBottom: '3px' }}>{s.label}</div>
            <Money value={s.value} style={{ fontWeight: 650, fontSize: '15px', color: s.color }} />
          </div>
        ))}
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
            <Button onClick={handleAdd}>Boeken</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Annuleren</Button>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table className="ledger">
            <thead>
              <tr>
                {['Datum', 'Omschrijving', 'Categorie', 'Type', 'Bedrag', ''].map((h, hi) => (
                  <th key={hi} className={hi >= 4 ? 'r' : ''}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text-3)', padding: '40px' }}>
                    {(entries || []).length === 0
                      ? 'Nog geen memoriaalboekingen. Gebruik dit voor correcties, restverschillen en terugboekingen.'
                      : `Geen boekingen in ${year}.`}
                  </td>
                </tr>
              ) : shown.map(e => (
                <tr key={e.id} style={{ opacity: e.is_reversal ? 0.75 : 1 }}>
                  <td style={td}><span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{fmtDate(e.date)}</span></td>
                  <td style={td}>
                    {e.description}
                    {e.is_reversal && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', background: 'var(--warning-soft)', color: 'var(--warning)', padding: '1px 6px', borderRadius: '8px' }}>Terugboeking</span>
                    )}
                  </td>
                  <td style={td}><span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{e.category}</span></td>
                  <td style={td}>
                    <span style={{
                      fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '8px',
                      background: entryIsCredit(e) ? 'var(--success-soft)' : 'var(--danger-soft)',
                      color: entryIsCredit(e) ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {entryIsCredit(e) ? 'Credit' : 'Debet'}
                    </span>
                  </td>
                  <td className="r">
                    <Money value={entryIsCredit(e) ? Math.abs(Number(e.amount || 0)) : -Math.abs(Number(e.amount || 0))} signed style={{ fontWeight: 600, color: entryIsCredit(e) ? 'var(--success)' : 'var(--danger)' }} />
                  </td>
                  <td className="r">
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {!e.is_reversal && !isReversed(e) && (
                        <Button size="sm" variant="secondary" onClick={() => handleReverse(e)} title="Maak een tegengestelde boeking aan">
                          <RotateCcw size={11} /> Terugboeken
                        </Button>
                      )}
                      {!e.is_reversal && isReversed(e) && (
                        <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Teruggeboekt</span>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(e.id)} title="Verwijderen" aria-label="Verwijderen" style={{ padding: '0 8px', color: 'var(--danger)' }}>
                        <Trash2 size={13} />
                      </Button>
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

// ── Grootboek tab ─────────────────────────────────────────────────────────────
function GrootboekTab({ invoices, expenses, entries, clients, ledgerAccounts }) {
  const currentYear = currentYearNow()
  const [year, setYear] = useState(currentYear)

  const years = useMemo(() => collectYears(invoices, expenses, entries), [invoices, expenses, entries])

  const rows = useMemo(() => {
    const out = []
    ;(invoices || []).forEach(inv => {
      const d = inv.issueDate || inv.date
      if (!isRevenueInvoice(inv) || !d || new Date(d).getFullYear() !== year) return
      const clientName = (clients || []).find(c => c.id === inv.clientId)?.name || inv.clientName || '—'
      out.push({
        id: `inv_${inv.id}`, date: d, type: 'Omzet',
        title: clientName, subtitle: `${inv.number || inv.id}${inv.status === 'credit_note' ? ' · creditnota' : inv.status !== 'paid' ? ' · nog niet betaald' : ''}`,
        ledger: null, amount: invoiceExBtw(inv.items),
      })
    })
    ;(expenses || []).forEach(exp => {
      if (!isCountedExpense(exp) || !exp.date || new Date(exp.date).getFullYear() !== year) return
      const bankText = stripBankPrefix(exp.notes)
      const vendor = exp.vendor || bankText || 'Onbekende leverancier'
      const subtitle = [
        exp.category || null,
        bankText && bankText !== vendor ? bankText : null,
        exp.source === 'bank' ? 'via Bank' : null,
      ].filter(Boolean).join(' · ')
      out.push({
        id: `exp_${exp.id}`, date: exp.date, type: 'Kostenpost',
        title: vendor, subtitle,
        ledger: exp.ledgerAccount || null, amount: -expenseNet(exp),
      })
    })
    ;(entries || []).forEach(e => {
      if (!e.date || new Date(e.date).getFullYear() !== year) return
      const bankText = stripBankPrefix(e.reference)
      const title = e.description || bankText || 'Journaalpost'
      const subtitle = [
        e.category || null,
        bankText && bankText !== title ? bankText : null,
      ].filter(Boolean).join(' · ')
      out.push({
        id: `ent_${e.id}`, date: e.date, type: 'Journaalpost',
        title, subtitle,
        ledger: e.ledgerCode || null, amount: entrySignedAmount(e),
      })
    })
    return out.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [invoices, expenses, entries, clients, year])

  const totals = useMemo(() => {
    const t = { Omzet: 0, Kostenpost: 0, Journaalpost: 0 }
    rows.forEach(r => { t[r.type] += r.amount })
    return { ...t, grandTotal: t.Omzet + t.Kostenpost + t.Journaalpost }
  }, [rows])

  const typeColor = { Omzet: 'var(--success)', Kostenpost: 'var(--danger)', Journaalpost: 'var(--accent)' }
  const typeSoft = { Omzet: 'var(--success-soft)', Kostenpost: 'var(--danger-soft)', Journaalpost: 'var(--accent-soft)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Jaar:</span>
          <select style={{ ...inp, width: 'auto', padding: '6px 12px' }} value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'Omzet', value: totals.Omzet, color: 'var(--success)' },
            { label: 'Kostenposten', value: totals.Kostenpost, color: 'var(--danger)' },
            { label: 'Journaalposten', value: totals.Journaalpost, color: 'var(--accent)' },
            { label: 'Totaal', value: totals.grandTotal, color: totals.grandTotal >= 0 ? 'var(--success)' : 'var(--danger)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-3)', marginBottom: '3px' }}>{s.label}</div>
              <Money value={s.value} style={{ fontWeight: 650, fontSize: '15px', color: s.color }} />
            </div>
          ))}
        </div>
      </div>

      <Card>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: '600', color: 'var(--text)', fontSize: '14px' }}>Grootboek {year}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ledger">
            <thead>
              <tr>
                {['Datum', 'Type', 'Met wie / omschrijving', 'Grootboek', 'Bedrag'].map((h, hi) => (
                  <th key={h} className={hi === 4 ? 'r' : ''}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text-3)', padding: '40px' }}>
                    Geen boekingen gevonden in {year}.
                  </td>
                </tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  <td style={td}><span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{fmtDate(r.date)}</span></td>
                  <td style={td}>
                    <span style={{
                      fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '8px',
                      background: typeSoft[r.type], color: typeColor[r.type],
                    }}>
                      {r.type}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: '600', color: 'var(--text)' }}>{r.title}</div>
                    {r.subtitle && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{r.subtitle}</div>}
                  </td>
                  <td style={td}>
                    {r.ledger ? (
                      <>
                        <span className="num" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)' }}>{r.ledger}</span>
                        {ledgerLabel(ledgerAccounts, r.ledger) && (
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{ledgerLabel(ledgerAccounts, r.ledger)}</div>
                        )}
                      </>
                    ) : <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>—</span>}
                  </td>
                  <td className="r">
                    <Money value={r.amount} signed style={{ fontWeight: 600, color: r.amount >= 0 ? 'var(--success)' : 'var(--danger)' }} />
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Totaal</td>
                  <td className="r">
                    <Money value={totals.grandTotal} style={{ fontSize: '14px', color: totals.grandTotal >= 0 ? 'var(--success)' : 'var(--danger)' }} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
// ── Balans tab ────────────────────────────────────────────────────────────────
// Indicatieve balans op een peildatum. Eigen vermogen is de sluitpost (bezittingen − schulden).
function BalansTab({ invoices, expenses, assets, transactions, purchaseInvoices, clients }) {
  const currentYear = currentYearNow()
  const [peil, setPeil] = useState(todayISO())
  const peilDate = new Date(peil + 'T23:59:59')
  const peilYear = peilDate.getFullYear()

  const data = useMemo(() => {
    // Vaste activa: boekwaarde na afschrijving van het peiljaar — exact dezelfde regel als de W&V
    // (aanschafjaar = volledig eerste jaar). Afgeboekte activa tellen mee tot hun afboekdatum.
    const fixed = (assets || [])
      .filter(a => a.purchase_date && String(a.purchase_date).slice(0, 10) <= peil)
      .filter(a => a.is_active !== false || (a.deactivatedAt && String(a.deactivatedAt).slice(0, 10) > peil))
      .map(a => ({ label: a.name, value: assetBookValueForBalance(a, peilYear) }))
    // Debiteuren: openstaande facturen met factuurdatum t/m peildatum
    const debtors = (invoices || []).filter(i => invoiceDate(i) && new Date(invoiceDate(i)) <= peilDate)
      .map(i => ({ label: `${i.number} · ${(clients || []).find(c => c.id === i.clientId)?.name || ''}`, value: invoiceOpenAmount(i) }))
      .filter(d => d.value > 0.005)
    // Liquide middelen: laatste saldo per rekening op of vóór peildatum
    const byAccount = {}
    ;(transactions || []).filter(t => t.date && t.balance !== null && t.balance !== undefined && new Date(t.date) <= peilDate).forEach(t => {
      const k = t.account || 'Bank'
      if (!byAccount[k] || t.date >= byAccount[k].date) byAccount[k] = { date: t.date, value: Number(t.balance) }
    })
    const cash = Object.entries(byAccount).map(([label, v]) => ({ label: `${label} (saldo ${fmtDate(v.date)})`, value: v.value }))
    // BTW lopend kwartaal t/m peildatum
    const q = Math.floor(peilDate.getMonth() / 3)
    const vat = buildVatReturn({ invoices, expenses, clients, start: new Date(peilYear, q * 3, 1), end: peilDate })
    // Crediteuren: onbetaalde inkoopfacturen
    const creditors = (purchaseInvoices || []).filter(p => p.status !== 'paid' && p.date && new Date(p.date) <= peilDate)
      .map(p => ({ label: `${p.supplier}${p.invoiceNumber ? ' · ' + p.invoiceNumber : ''}`, value: Number(p.totalAmount || 0) }))

    const sum = (arr) => arr.reduce((s, x) => s + x.value, 0)
    const activa = [
      { title: 'Vaste activa', rows: fixed },
      { title: 'Debiteuren', rows: debtors },
      { title: 'Liquide middelen', rows: cash },
      ...(vat.saldo < 0 ? [{ title: 'Te vorderen BTW', rows: [{ label: `Q${q + 1} ${peilYear} t/m peildatum`, value: -vat.saldo }] }] : []),
    ]
    const schulden = [
      { title: 'Crediteuren', rows: creditors },
      ...(vat.saldo > 0 ? [{ title: 'Af te dragen BTW', rows: [{ label: `Q${q + 1} ${peilYear} t/m peildatum`, value: vat.saldo }] }] : []),
    ]
    const totalActiva = activa.reduce((s, g) => s + sum(g.rows), 0)
    const totalSchulden = schulden.reduce((s, g) => s + sum(g.rows), 0)
    return { activa, schulden, totalActiva, totalSchulden, equity: totalActiva - totalSchulden, hasBank: cash.length > 0, sum }
  }, [invoices, expenses, assets, transactions, purchaseInvoices, clients, peil]) // eslint-disable-line react-hooks/exhaustive-deps

  const Side = ({ title, groups, total, extra }) => (
    <Card style={{ flex: 1, minWidth: 300, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', fontWeight: 600, fontSize: '14px', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{title}</div>
      {groups.map(g => (
        <div key={g.title}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px 4px', fontSize: '12.5px', color: 'var(--text-2)', fontWeight: 600 }}>
            <span>{g.title}</span><Money value={data.sum(g.rows)} />
          </div>
          {g.rows.length === 0 && <div style={{ padding: '2px 16px 8px 28px', fontSize: '12px', color: 'var(--text-3)' }}>Geen</div>}
          {g.rows.slice(0, 8).map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 16px 3px 28px', fontSize: '12.5px', color: 'var(--text-3)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span><Money value={r.value} />
            </div>
          ))}
          {g.rows.length > 8 && <div style={{ padding: '2px 16px 6px 28px', fontSize: '12px', color: 'var(--text-3)' }}>en nog {g.rows.length - 8}</div>}
        </div>
      ))}
      {extra}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', marginTop: 8, borderTop: '1px solid var(--border-2)', fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
        <span>Totaal</span><Money value={total} />
      </div>
    </Card>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Peildatum</span>
        <input type="date" style={{ ...inp, width: 'auto', padding: '6px 10px' }} value={peil} onChange={e => e.target.value && setPeil(e.target.value)} />
        <Segmented
          value={peil}
          onChange={setPeil}
          options={[
            ...[currentYear - 1, currentYear - 2].map(y => ({ id: `${y}-12-31`, label: `31-12-${y}` })),
            { id: todayISO(), label: 'Vandaag' },
          ]}
        />
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Side title="Bezittingen" groups={data.activa} total={data.totalActiva} />
        <Side title="Eigen vermogen en schulden" groups={data.schulden} total={data.totalActiva}
          extra={
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px 4px', fontSize: '12.5px', color: 'var(--text-2)', fontWeight: 600 }}>
              <span>Eigen vermogen</span><Money value={data.equity} style={{ color: data.equity < 0 ? 'var(--danger)' : 'var(--text-2)' }} />
            </div>
          } />
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: 0, maxWidth: 680, lineHeight: 1.6 }}>
        Indicatieve balans. Banksaldo komt uit je geïmporteerde bankafschriften{data.hasBank ? '' : ' (nog geen import met saldo gevonden)'}; debiteuren zijn facturen die nu nog openstaan.
        Eigen vermogen is het verschil tussen bezittingen en schulden. Gebruik dit als overzicht, niet als vervanging van een jaarrekening.
      </p>
    </div>
  )
}

export default function BoekhoudenView({ invoices, expenses, assets, setAssets, entries, setEntries, clients, ledgerAccounts, transactions = [], purchaseInvoices = [] }) {
  const { t } = useLang()
  const [tab, setTab] = useState('wv')
  const tabs = [
    { id: 'wv', label: t('bk.tabPL') },
    { id: 'balans', label: 'Balans' },
    { id: 'grootboek', label: 'Grootboek' },
    { id: 'activa', label: t('bk.tabAssets') },
    { id: 'memoriaal', label: t('bk.tabJournal') },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: '0 0 4px' }}>{t('bk.title')}</h1>
        <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>{t('bk.subtitle')}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <Segmented value={tab} onChange={setTab} options={tabs} />
      </div>

      {tab === 'wv' && <WinstVerliesTab invoices={invoices} expenses={expenses} assets={assets} entries={entries} clients={clients} ledgerAccounts={ledgerAccounts} />}
      {tab === 'balans' && <BalansTab invoices={invoices} expenses={expenses} assets={assets} transactions={transactions} purchaseInvoices={purchaseInvoices} clients={clients} />}
      {tab === 'grootboek' && <GrootboekTab invoices={invoices} expenses={expenses} entries={entries} clients={clients} ledgerAccounts={ledgerAccounts} />}
      {tab === 'activa' && <VasteActivaTab assets={assets} setAssets={setAssets} />}
      {tab === 'memoriaal' && <MemoriaalTab entries={entries} setEntries={setEntries} />}
    </div>
  )
}
