import { useState, useRef, useMemo, useEffect } from 'react'
import { useLang } from './LangContext'
import {
  Upload, Search, Trash2, X, Check, Sparkles, Link2, Receipt, FileText,
  EyeOff, RotateCcw, AlertCircle, ChevronDown, Loader2, Ban, Landmark,
  ArrowDownCircle, ArrowUpCircle, AlertTriangle, Star,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const genId = (p = 'bt') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

const fmtMoney = (n, cur = 'EUR') => {
  const num = Number(n || 0)
  const symbol = cur === 'EUR' ? '€\u00a0' : cur === 'USD' ? '$\u00a0' : cur === 'GBP' ? '£\u00a0' : `${cur}\u00a0`
  return symbol + num.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const fmtDayLabel = (key) => {
  const d = new Date(key)
  if (isNaN(d)) return 'Onbekende datum'
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

const BANK_ENTRY_CATEGORIES = ['Kostenpost', 'Omzetaanpassing', 'Correctie', 'Overig']

// Interne overboeking tussen eigen (Revolut-)rekeningen — waarschuw voor per ongeluk boeken als kosten/omzet.
// Let op: "TRANSFER" is in Revolut ook het type voor gewone inkomende/uitgaande SEPA-betalingen van
// klanten/leveranciers, dus daar alleen op matchen geeft valse positieven. Alleen echte interne-signalen tellen mee.
const isLikelyInternalTransfer = (tx) => {
  const type = (tx.type || '').toLowerCase()
  const desc = `${tx.description || ''} ${tx.reference || ''}`.toLowerCase()
  return type.includes('exchange') || desc.includes('between accounts') || desc.includes('to eur balance') || desc.includes('to my')
}

// Beste match op bedrag (exact, binnen 1 cent) voor koppelen aan factuur/uitgave
const bestAmountMatchId = (tx, options, mode) => {
  const target = Math.abs(Number(tx.amount) || 0)
  let bestId = null
  let bestDiff = Infinity
  ;(options || []).forEach(o => {
    const oAmt = Number(mode === 'invoice' ? (o.amountIncl || o.total || 0) : (o.amount || o.amountIncl || 0))
    const diff = Math.abs(oAmt - target)
    if (diff < bestDiff) { bestDiff = diff; bestId = o.id }
  })
  return bestDiff <= 0.01 ? bestId : null
}

// ── CSV parsing (Revolut export) ─────────────────────────────────────────────
function parseCSVLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { out.push(cur); cur = '' }
      else cur += c
    }
  }
  out.push(cur)
  return out
}

function parseRevolutCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
  const idx = (name) => headers.indexOf(name)
  const get = (cols, name) => { const i = idx(name); return i >= 0 ? (cols[i] || '').trim() : '' }

  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line)
    const date = get(cols, 'date completed (utc)') || get(cols, 'date started (utc)')
    const amount = parseFloat(get(cols, 'amount')) || 0
    // "payer" bevat altijd de eigen accounthouder (bv. "Den Hartogh Solutions"), nooit de
    // werkelijke tegenpartij — daarom NIET meenemen in de fallback-keten.
    const counterparty = get(cols, 'beneficiary name') || get(cols, 'sender name') || get(cols, 'description')
    return {
      externalId: get(cols, 'id'),
      account: get(cols, 'account'),
      date,
      description: get(cols, 'description'),
      counterparty,
      reference: get(cols, 'reference'),
      type: get(cols, 'type'),
      amount,
      currency: get(cols, 'payment currency') || 'EUR',
      origAmount: parseFloat(get(cols, 'orig amount')) || null,
      origCurrency: get(cols, 'orig currency') || null,
      fee: parseFloat(get(cols, 'fee')) || 0,
      balance: parseFloat(get(cols, 'balance')) || null,
    }
  }).filter(r => r.date && r.externalId)
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
const inp = {
  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
  borderRadius: '8px', color: 'var(--text)', padding: '8px 11px',
  fontSize: '12.5px', width: '100%', outline: 'none', boxSizing: 'border-box',
}
const Card = ({ children, style = {} }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', ...style }}>
    {children}
  </div>
)
const btn = (variant = 'ghost') => ({
  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 11px',
  borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
  border: variant === 'primary' ? 'none' : '1px solid var(--border-2)',
  background: variant === 'primary' ? 'var(--accent)' : 'var(--surface)',
  color: variant === 'primary' ? '#fff' : 'var(--text-2)',
})

export default function BankView({
  transactions = [], setTransactions,
  invoices = [], expenses = [], setExpenses, allExpenses, entries = [], setEntries,
  clients = [], settings = {}, activeEntity, callAI, suggestLedgerAccount, getLedgerAccounts,
  jurisdictionInfo,
}) {
  const [filter, setFilter] = useState('unmatched')
  const [search, setSearch] = useState('')
  const [importMsg, setImportMsg] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [bookTx, setBookTx] = useState(null)      // tx being booked as journaalpost
  const [linkTx, setLinkTx] = useState(null)       // { tx, mode: 'invoice' | 'expense' }
  const [selected, setSelected] = useState(new Set())
  const fileRef = useRef()

  useEffect(() => { setSelected(new Set()) }, [filter, search])

  const jurisdiction = settings.jurisdiction || 'NL'
  const ledgerAccounts = useMemo(() => (getLedgerAccounts ? getLedgerAccounts(jurisdiction) : []), [jurisdiction, getLedgerAccounts])
  const salesTax = jurisdictionInfo?.salesTax || { name: 'BTW', rates: [0, 9, 21], standard: 21 }

  // ── Import ───────────────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const parsed = parseRevolutCSV(ev.target.result)
      const existingIds = new Set((transactions || []).map(t => t.externalId).filter(Boolean))
      const fresh = parsed.filter(r => !existingIds.has(r.externalId))
      const skipped = parsed.length - fresh.length

      const rows = fresh.map(r => {
        const rule = suggestLedgerAccount ? suggestLedgerAccount(r.counterparty, jurisdiction) : null
        return {
          id: genId(), entityId: activeEntity?.id || null,
          status: 'unmatched',
          ...r,
          aiLedgerCode: rule?.code || null,
          aiCategory: rule?.category || null,
          aiConfidence: rule ? 1 : null,
          aiNote: rule?.note || (rule ? 'Regel-match op naam' : null),
        }
      })

      await setTransactions(prev => [...rows, ...(prev || [])])
      setImportMsg({ imported: rows.length, skipped })
      e.target.value = ''
    }
    reader.readAsText(file, 'UTF-8')
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  const updateTx = (id, patch) => setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  const deleteTx = (id) => setTransactions(prev => prev.filter(t => t.id !== id))

  const markPersonal = (id) => updateTx(id, { status: 'personal', matchedInvoiceId: null, matchedExpenseId: null, boekEntryId: null })
  const markIgnored = (id) => updateTx(id, { status: 'ignored', matchedInvoiceId: null, matchedExpenseId: null, boekEntryId: null })
  const resetTx = (id) => updateTx(id, { status: 'unmatched', matchedInvoiceId: null, matchedExpenseId: null, boekEntryId: null })

  const confirmBook = (tx, form) => {
    const amountIncl = Math.abs(Number(tx.amount) || 0)

    // Uitgave geboekt als aftrekbare kostenpost → als expense i.p.v. journaalpost,
    // zodat hij automatisch meetelt in de BTW-aangifte (die alleen expenses uitleest).
    if (form.asExpense && Number(tx.amount) < 0) {
      const btwRate = Number(form.btwRate) || 0
      const btwAmount = +(amountIncl - amountIncl / (1 + btwRate / 100)).toFixed(2)
      const expenseId = genId('exp')
      const expense = {
        id: expenseId, entityId: activeEntity?.id || null,
        status: 'processed', source: 'bank',
        vendor: form.description || tx.counterparty || tx.description || '',
        date: tx.date,
        currency: tx.currency || 'EUR',
        originalAmount: amountIncl, exchangeRate: 1,
        amount: amountIncl, btwAmount, btwRate,
        category: form.category, ledgerAccount: form.ledgerCode || '',
        notes: `Bank: ${tx.description || tx.externalId}`,
        capturedAt: new Date().toISOString(),
      }
      const base = allExpenses || expenses
      setExpenses([expense, ...base])
      updateTx(tx.id, { status: 'matched', matchedExpenseId: expenseId })
      setBookTx(null)
      return
    }

    const entryId = genId('be')
    const entry = {
      id: entryId, entityId: activeEntity?.id || null,
      date: tx.date, category: form.category,
      description: form.description || tx.counterparty || tx.description,
      amount: amountIncl,
      isDebit: Number(tx.amount) < 0,
      ledgerCode: form.ledgerCode || null,
      reference: `Bank: ${tx.description || tx.externalId}`,
    }
    setEntries(prev => [entry, ...(prev || [])])
    updateTx(tx.id, { status: 'matched', boekEntryId: entryId })
    setBookTx(null)
  }

  const confirmLink = (tx, mode, targetId) => {
    if (mode === 'invoice') updateTx(tx.id, { status: 'matched', matchedInvoiceId: targetId })
    else updateTx(tx.id, { status: 'matched', matchedExpenseId: targetId })
    setLinkTx(null)
  }

  // Bouwt de expense/journaalpost die hoort bij de AI-suggestie van een transactie
  // (gedeeld door de 1-klik accept en de bulk-accept, zodat de boekingslogica gelijk blijft).
  const buildAIBooking = (tx) => {
    const isExpense = Number(tx.amount) < 0
    const amountIncl = Math.abs(Number(tx.amount) || 0)
    const category = tx.aiCategory && BANK_ENTRY_CATEGORIES.includes(tx.aiCategory) ? tx.aiCategory : (isExpense ? 'Kostenpost' : 'Omzetaanpassing')
    if (isExpense) {
      const btwRate = salesTax?.standard ?? 21
      const btwAmount = +(amountIncl - amountIncl / (1 + btwRate / 100)).toFixed(2)
      const expenseId = genId('exp')
      return {
        patch: { status: 'matched', matchedExpenseId: expenseId },
        expense: {
          id: expenseId, entityId: activeEntity?.id || null,
          status: 'processed', source: 'bank',
          vendor: tx.counterparty || tx.description || '',
          date: tx.date, currency: tx.currency || 'EUR',
          originalAmount: amountIncl, exchangeRate: 1,
          amount: amountIncl, btwAmount, btwRate,
          category, ledgerAccount: tx.aiLedgerCode || '',
          notes: `Bank: ${tx.description || tx.externalId}`,
          capturedAt: new Date().toISOString(),
        },
      }
    }
    const entryId = genId('be')
    return {
      patch: { status: 'matched', boekEntryId: entryId },
      entry: {
        id: entryId, entityId: activeEntity?.id || null,
        date: tx.date, category,
        description: tx.counterparty || tx.description,
        amount: amountIncl, isDebit: false,
        ledgerCode: tx.aiLedgerCode || null,
        reference: `Bank: ${tx.description || tx.externalId}`,
      },
    }
  }

  const quickAcceptAI = (tx) => {
    if (!tx.aiLedgerCode) return
    const { patch, expense, entry } = buildAIBooking(tx)
    if (expense) { const base = allExpenses || expenses; setExpenses([expense, ...base]) }
    if (entry) setEntries(prev => [entry, ...(prev || [])])
    updateTx(tx.id, patch)
  }

  // ── Bulk-selectie ────────────────────────────────────────────────────────
  const clearSelection = () => setSelected(new Set())
  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const bulkMarkPersonal = () => {
    setTransactions(prev => prev.map(t => selected.has(t.id) ? { ...t, status: 'personal', matchedInvoiceId: null, matchedExpenseId: null, boekEntryId: null } : t))
    clearSelection()
  }
  const bulkMarkIgnored = () => {
    setTransactions(prev => prev.map(t => selected.has(t.id) ? { ...t, status: 'ignored', matchedInvoiceId: null, matchedExpenseId: null, boekEntryId: null } : t))
    clearSelection()
  }
  const bulkDelete = () => {
    setTransactions(prev => prev.filter(t => !selected.has(t.id)))
    clearSelection()
  }
  const bulkAcceptAI = () => {
    const targets = (transactions || []).filter(t => selected.has(t.id) && t.status === 'unmatched' && t.aiLedgerCode)
    if (targets.length === 0) { clearSelection(); return }
    const newExpenses = [], newEntries = [], patches = {}
    targets.forEach(tx => {
      const { patch, expense, entry } = buildAIBooking(tx)
      patches[tx.id] = patch
      if (expense) newExpenses.push(expense)
      if (entry) newEntries.push(entry)
    })
    if (newExpenses.length) { const base = allExpenses || expenses; setExpenses([...newExpenses, ...base]) }
    if (newEntries.length) setEntries(prev => [...newEntries, ...(prev || [])])
    setTransactions(prev => prev.map(t => patches[t.id] ? { ...t, ...patches[t.id] } : t))
    clearSelection()
  }

  // ── AI suggesties ──────────────────────────────────────────────────────
  const runAISuggestions = async () => {
    setAiError(null)
    const candidates = (transactions || [])
      .filter(t => t.status === 'unmatched' && !t.aiLedgerCode)
      .slice(0, 40)
    if (candidates.length === 0) { setAiError('Geen ongematchte transacties zonder suggestie gevonden.'); return }
    if (!settings.apiKey && !settings.openaiApiKey) {
      setAiError('Geen AI API key ingesteld. Vul een key in via Instellingen → AI.')
      return
    }
    setAiBusy(true)
    try {
      const system = `Je bent een Nederlandse boekhoudassistent. Je krijgt een genummerde lijst banktransacties. Bepaal per transactie: of het zakelijk is, welke grootboekrekening het beste past uit de gegeven lijst, een korte categorie en een betrouwbaarheid (0-1). Antwoord ALLEEN met een geldige JSON-array, geen uitleg en geen markdown: [{"i":0,"isBusiness":true,"ledgerCode":"4420","category":"Software/SaaS","confidence":0.9,"note":"korte toelichting"}]`
      const prompt = `Grootboekrekeningen:\n${ledgerAccounts.map(a => `${a.code} - ${a.name}`).join('\n')}\n\nTransacties:\n${candidates.map((t, i) => `${i}. ${t.amount < 0 ? 'Uitgave' : 'Inkomst'} ${fmtMoney(Math.abs(t.amount), t.currency)} — ${t.counterparty || t.description}${t.description && t.description !== t.counterparty ? ` (${t.description})` : ''}`).join('\n')}`

      const raw = await callAI({ system, prompt, apiKey: settings.apiKey, openaiApiKey: settings.openaiApiKey, maxTokens: 3000 })
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const results = JSON.parse(cleaned)

      setTransactions(prev => prev.map(t => {
        const ci = candidates.findIndex(c => c.id === t.id)
        if (ci === -1) return t
        const r = results.find(x => x.i === ci)
        if (!r) return t
        return {
          ...t,
          aiLedgerCode: r.ledgerCode || null,
          aiCategory: r.category || null,
          aiConfidence: typeof r.confidence === 'number' ? r.confidence : null,
          aiNote: r.isBusiness === false ? `Mogelijk privé — ${r.note || ''}`.trim() : (r.note || null),
          aiIsBusiness: r.isBusiness !== false,
        }
      }))
    } catch (err) {
      setAiError(err.message || 'AI-suggestie mislukt')
    } finally {
      setAiBusy(false)
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { all: transactions.length, unmatched: 0, matched: 0, personal: 0, ignored: 0 }
    transactions.forEach(t => { c[t.status] = (c[t.status] || 0) + 1 })
    return c
  }, [transactions])

  const filtered = useMemo(() => {
    let rows = [...(transactions || [])]
    if (filter !== 'all') rows = rows.filter(t => t.status === filter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.counterparty || '').toLowerCase().includes(q) ||
        (t.reference || '').toLowerCase().includes(q))
    }
    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [transactions, filter, search])

  const visibleIds = useMemo(() => filtered.map(t => t.id), [filtered])
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds))

  // Groepeer per dag zodat de lijst overzichtelijker is bij veel transacties (geen paginering)
  const groups = useMemo(() => {
    const map = new Map()
    filtered.forEach(t => {
      const key = t.date ? t.date.slice(0, 10) : 'onbekend'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(t)
    })
    return Array.from(map.entries()).map(([date, items]) => ({
      date, items, net: items.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    }))
  }, [filtered])

  // Alle facturen behalve concepten/creditnota's — ook al betaalde facturen zijn koppelbaar
  // (bv. handmatig als betaald gemarkeerd voordat de bank-CSV geïmporteerd werd).
  const openInvoices = useMemo(() => (invoices || []).filter(i => !['draft', 'credit_note'].includes(i.status)), [invoices])

  const FILTERS = [
    { id: 'unmatched', label: 'Ongematcht' },
    { id: 'matched', label: 'Gematcht' },
    { id: 'personal', label: 'Privé' },
    { id: 'ignored', label: 'Genegeerd' },
    { id: 'all', label: 'Alle' },
  ]

  const StatusBadge = ({ status }) => {
    const map = {
      unmatched: { bg: 'var(--warning-soft)', c: 'var(--warning)', label: 'Ongematcht' },
      matched: { bg: 'var(--success-soft)', c: 'var(--success)', label: 'Gematcht' },
      personal: { bg: 'var(--surface-3)', c: 'var(--text-3)', label: 'Privé' },
      ignored: { bg: 'var(--surface-3)', c: 'var(--text-3)', label: 'Genegeerd' },
    }
    const s = map[status] || map.unmatched
    return (
      <span style={{ fontSize: '10.5px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: s.bg, color: s.c, whiteSpace: 'nowrap' }}>
        {s.label}
      </span>
    )
  }

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)', letterSpacing: '-0.025em', margin: '0 0 5px', display: 'flex', alignItems: 'center', gap: '9px' }}>
            <Landmark size={22} style={{ color: 'var(--accent)' }} /> Bank bewegingen
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
            Importeer een CSV-export uit Revolut, koppel transacties aan facturen/kosten of boek ze als journaalpost.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
          <button style={btn()} onClick={() => fileRef.current?.click()}>
            <Upload size={13} /> CSV importeren
          </button>
          <button style={btn('primary')} onClick={runAISuggestions} disabled={aiBusy}>
            {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {aiBusy ? 'Bezig…' : 'AI-suggesties'}
          </button>
        </div>
      </div>

      {importMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: '10px', padding: '11px 15px', marginBottom: '14px' }}>
          <Check size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--success)', flex: 1 }}>
            {importMsg.imported} nieuwe transactie{importMsg.imported !== 1 ? 's' : ''} geïmporteerd{importMsg.skipped > 0 ? ` · ${importMsg.skipped} al eerder geïmporteerd (overgeslagen)` : ''}
          </span>
          <button onClick={() => setImportMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', padding: 0, display: 'flex' }}><X size={14} /></button>
        </div>
      )}
      {aiError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '10px', padding: '11px 15px', marginBottom: '14px' }}>
          <AlertCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--danger)', flex: 1 }}>{aiError}</span>
          <button onClick={() => setAiError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, display: 'flex' }}><X size={14} /></button>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '3px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px' }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px',
              borderRadius: '7px', fontSize: '12.5px', fontWeight: '600', border: 'none', cursor: 'pointer',
              background: filter === f.id ? 'var(--accent-soft)' : 'transparent',
              color: filter === f.id ? 'var(--accent)' : 'var(--text-3)',
            }}>
              {f.label} <span style={{ opacity: 0.6 }}>{counts[f.id] || 0}</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', marginLeft: 'auto', minWidth: '220px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input style={{ ...inp, paddingLeft: '30px' }} placeholder="Zoeken…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* ── Bulk-actiebalk ── */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: '10px', padding: '9px 13px', marginBottom: '14px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--accent)' }}>{selected.size} geselecteerd</span>
          <button style={btn('primary')} onClick={bulkAcceptAI}>
            <Sparkles size={12} /> Accepteer AI-suggesties
          </button>
          <button style={btn()} onClick={bulkMarkPersonal}><EyeOff size={12} /> Privé</button>
          <button style={btn()} onClick={bulkMarkIgnored}><Ban size={12} /> Negeer</button>
          <button style={{ ...btn(), color: 'var(--danger)' }} onClick={bulkDelete}><Trash2 size={12} /> Verwijderen</button>
          <button style={{ ...btn(), marginLeft: 'auto' }} onClick={clearSelection}><X size={12} /> Deselecteer</button>
        </div>
      )}

      {/* ── Transaction list (gegroepeerd per dag) ── */}
      <Card style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
            Geen transacties in deze weergave. Importeer een CSV om te beginnen.
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} title="Selecteer alles in deze weergave" />
              <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Selecteer alles ({filtered.length})
              </span>
            </div>
            {groups.map(g => (
              <div key={g.date}>
                <div style={{
                  position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 16px', background: 'var(--surface-3)', borderBottom: '1px solid var(--border)',
                  fontSize: '11px', fontWeight: '700', color: 'var(--text-3)',
                }}>
                  <span>{fmtDayLabel(g.date)}</span>
                  <span style={{ fontFamily: 'monospace' }}>{g.net < 0 ? '-' : '+'}{fmtMoney(Math.abs(g.net))}</span>
                </div>
                {g.items.map(tx => (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--border)',
                    background: selected.has(tx.id) ? 'var(--accent-soft)' : 'transparent',
                  }}>
                    <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)} />

                    {tx.amount < 0
                      ? <ArrowUpCircle size={17} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                      : <ArrowDownCircle size={17} style={{ color: 'var(--success)', flexShrink: 0 }} />}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {tx.description || tx.counterparty || '—'}
                        {isLikelyInternalTransfer(tx) && tx.status === 'unmatched' && (
                          <span title="Lijkt een interne overboeking tussen eigen rekeningen — controleer voor je boekt" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700', color: 'var(--warning)', background: 'var(--warning-soft)', padding: '2px 6px', borderRadius: '10px', flexShrink: 0 }}>
                            <AlertTriangle size={10} /> Interne overboeking?
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.counterparty && tx.counterparty !== tx.description ? tx.counterparty : ''}{tx.account ? ` · ${tx.account}` : ''}
                      </div>
                      {tx.aiLedgerCode && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                          <Sparkles size={10} style={{ color: 'var(--accent)' }} />
                          <span style={{ fontSize: '10.5px', color: 'var(--accent)', fontWeight: '600' }}>
                            {tx.aiLedgerCode} · {tx.aiCategory}{tx.aiConfidence != null ? ` (${Math.round(tx.aiConfidence * 100)}%)` : ''}
                          </span>
                          {tx.status === 'unmatched' && (
                            <button title="Accepteer suggestie en boek direct" onClick={() => quickAcceptAI(tx)} style={{
                              display: 'flex', alignItems: 'center', gap: '3px', border: 'none', cursor: 'pointer',
                              background: 'var(--success-soft)', color: 'var(--success)', borderRadius: '20px',
                              fontSize: '10px', fontWeight: '700', padding: '2px 7px',
                            }}>
                              <Check size={9} /> Accepteer
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ width: '110px', flexShrink: 0, textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', fontWeight: '700', color: tx.amount < 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {tx.amount < 0 ? '-' : '+'}{fmtMoney(Math.abs(tx.amount), tx.currency)}
                    </div>

                    <div style={{ width: '92px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                      <StatusBadge status={tx.status} />
                    </div>

                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {tx.status === 'unmatched' && (
                        <>
                          <button title="Boek als journaalpost" onClick={() => setBookTx(tx)} style={{ ...btn(), padding: '5px 8px' }}>
                            <Receipt size={12} />
                          </button>
                          <button title="Koppel aan factuur" onClick={() => setLinkTx({ tx, mode: 'invoice' })} style={{ ...btn(), padding: '5px 8px' }}>
                            <FileText size={12} />
                          </button>
                          <button title="Koppel aan uitgave" onClick={() => setLinkTx({ tx, mode: 'expense' })} style={{ ...btn(), padding: '5px 8px' }}>
                            <Link2 size={12} />
                          </button>
                          <button title="Markeer als privé" onClick={() => markPersonal(tx.id)} style={{ ...btn(), padding: '5px 8px' }}>
                            <EyeOff size={12} />
                          </button>
                          <button title="Negeer (interne overboeking)" onClick={() => markIgnored(tx.id)} style={{ ...btn(), padding: '5px 8px' }}>
                            <Ban size={12} />
                          </button>
                        </>
                      )}
                      {tx.status !== 'unmatched' && (
                        <button title="Ongedaan maken" onClick={() => resetTx(tx.id)} style={{ ...btn(), padding: '5px 8px' }}>
                          <RotateCcw size={12} />
                        </button>
                      )}
                      <button title="Verwijderen" onClick={() => deleteTx(tx.id)} style={{ ...btn(), padding: '5px 8px', color: 'var(--danger)' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Boek als journaalpost modal ── */}
      {bookTx && (
        <BookModal
          tx={bookTx}
          ledgerAccounts={ledgerAccounts}
          salesTax={salesTax}
          isInternalTransfer={isLikelyInternalTransfer(bookTx)}
          onCancel={() => setBookTx(null)}
          onConfirm={(form) => confirmBook(bookTx, form)}
        />
      )}

      {/* ── Koppel modal ── */}
      {linkTx && (
        <LinkModal
          tx={linkTx.tx}
          mode={linkTx.mode}
          options={linkTx.mode === 'invoice' ? openInvoices : expenses}
          clients={clients}
          isInternalTransfer={isLikelyInternalTransfer(linkTx.tx)}
          onCancel={() => setLinkTx(null)}
          onConfirm={(targetId) => confirmLink(linkTx.tx, linkTx.mode, targetId)}
        />
      )}
    </div>
  )
}

// ── Boek-als-journaalpost modal ──────────────────────────────────────────────
const BookModal = ({ tx, ledgerAccounts, salesTax, isInternalTransfer, onCancel, onConfirm }) => {
  const isExpense = Number(tx.amount) < 0
  const [form, setForm] = useState({
    description: tx.counterparty || tx.description || '',
    category: tx.aiCategory && BANK_ENTRY_CATEGORIES.includes(tx.aiCategory) ? tx.aiCategory : (isExpense ? 'Kostenpost' : 'Omzetaanpassing'),
    ledgerCode: tx.aiLedgerCode || '',
    asExpense: isExpense,
    btwRate: salesTax?.standard ?? 21,
  })
  const amountIncl = Math.abs(Number(tx.amount) || 0)
  const btwPreview = form.asExpense
    ? +(amountIncl - amountIncl / (1 + (Number(form.btwRate) || 0) / 100)).toFixed(2)
    : 0
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <Card style={{ width: '420px', maxWidth: '90vw', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>Boek als journaalpost</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px' }}>
          {fmtDate(tx.date)} · {fmtMoney(amountIncl, tx.currency)} {tx.amount < 0 ? 'uitgave' : 'inkomst'}
        </div>
        {isInternalTransfer && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: '8px', padding: '9px 11px', marginBottom: '12px' }}>
            <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: '11.5px', color: 'var(--warning)', fontWeight: '600' }}>
              Dit lijkt een interne overboeking tussen je eigen rekeningen. Controleer voor je boekt — gebruik anders "Negeer".
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Omschrijving" />
          <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {BANK_ENTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={inp} value={form.ledgerCode} onChange={e => setForm(f => ({ ...f, ledgerCode: e.target.value }))}>
            <option value="">— Grootboekrekening —</option>
            {ledgerAccounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
          </select>
          {isExpense && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer', padding: '2px 0' }}>
              <input type="checkbox" checked={form.asExpense} onChange={e => setForm(f => ({ ...f, asExpense: e.target.checked }))} />
              Boek als aftrekbare kostenpost ({salesTax?.name || 'BTW'}-aangifte)
            </label>
          )}
          {isExpense && form.asExpense && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select style={{ ...inp, flex: 1 }} value={form.btwRate} onChange={e => setForm(f => ({ ...f, btwRate: Number(e.target.value) }))}>
                {(salesTax?.rates || [0, 9, 21]).map(r => <option key={r} value={r}>{r}% {salesTax?.name || 'BTW'}</option>)}
              </select>
              <span style={{ fontSize: '11.5px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                {salesTax?.name || 'BTW'}: {fmtMoney(btwPreview, tx.currency)}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button style={btn()} onClick={onCancel}>Annuleren</button>
          <button style={btn('primary')} onClick={() => onConfirm(form)}><Check size={13} /> Boeken</button>
        </div>
      </Card>
    </div>
  )
}

// ── Koppel-aan-factuur/uitgave modal ─────────────────────────────────────────
const LinkModal = ({ tx, mode, options, clients, isInternalTransfer, onCancel, onConfirm }) => {
  const bestId = useMemo(() => bestAmountMatchId(tx, options, mode), [tx, options, mode])
  const [selected, setSelected] = useState(bestId || '')
  const clientName = (id) => clients.find(c => c.id === id)?.name || '—'
  const sortedOptions = useMemo(() => {
    if (!bestId) return options
    const best = options.find(o => o.id === bestId)
    return best ? [best, ...options.filter(o => o.id !== bestId)] : options
  }, [options, bestId])
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <Card style={{ width: '440px', maxWidth: '90vw', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
            Koppel aan {mode === 'invoice' ? 'factuur' : 'uitgave'}
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px' }}>
          {fmtDate(tx.date)} · {tx.counterparty || tx.description} · {fmtMoney(Math.abs(tx.amount), tx.currency)}
        </div>
        {isInternalTransfer && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: '8px', padding: '9px 11px', marginBottom: '12px' }}>
            <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: '11.5px', color: 'var(--warning)', fontWeight: '600' }}>
              Dit lijkt een interne overboeking tussen je eigen rekeningen. Controleer voor je koppelt.
            </span>
          </div>
        )}
        <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {options.length === 0 && (
            <div style={{ fontSize: '12.5px', color: 'var(--text-3)', padding: '10px 0' }}>Geen {mode === 'invoice' ? 'facturen' : 'uitgaven'} gevonden.</div>
          )}
          {sortedOptions.map(o => (
            <button
              key={o.id}
              onClick={() => setSelected(o.id)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 11px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                border: selected === o.id ? '1px solid var(--accent)' : '1px solid var(--border-2)',
                background: selected === o.id ? 'var(--accent-soft)' : 'var(--surface)',
              }}>
              <span style={{ fontSize: '12.5px', color: 'var(--text)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {mode === 'invoice' ? (o.number || 'Factuur') : (o.vendor || 'Uitgave')}
                {mode === 'invoice' && o.clientId ? ` · ${clientName(o.clientId)}` : ''}
                {mode === 'invoice' && o.status === 'paid' && (
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-3)', background: 'var(--surface-3)', padding: '2px 6px', borderRadius: '10px' }}>
                    Betaald
                  </span>
                )}
                {o.id === bestId && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '700', color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 6px', borderRadius: '10px' }}>
                    <Star size={9} /> Waarschijnlijke match
                  </span>
                )}
              </span>
              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-3)' }}>
                {fmtMoney(mode === 'invoice' ? (o.amountIncl || o.total || 0) : (o.amountIncl || o.amount || 0))}
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button style={btn()} onClick={onCancel}>Annuleren</button>
          <button style={btn('primary')} disabled={!selected} onClick={() => selected && onConfirm(selected)}>
            <Link2 size={13} /> Koppelen
          </button>
        </div>
      </Card>
    </div>
  )
}
