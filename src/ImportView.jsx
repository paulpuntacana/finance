import { useState, useRef } from 'react'
import { Plus, Trash2, Upload, Download, Check, AlertCircle, FileText, Receipt, X } from 'lucide-react'
import { computeInvoice } from './finance'
import { Button, Segmented, Money } from './ui'

const YEARS = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i)
const BTW_RATES = [0, 9, 21]
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'DOP']
const CATEGORIES = [
  'Software/SaaS', 'Hosting & Infra', 'Kantoorartikelen', 'Reiskosten',
  'Eten & Drinken', 'Marketing', 'Professionele diensten', 'Hardware', 'Overig'
]

const genId = (prefix = 'r') => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const blankInvoice = (year) => ({
  _id: genId(), number: '', client: '',
  date: `${year}-01-01`, amountExcl: '', btwRate: '21', currency: 'EUR', status: 'paid', paidAt: `${year}-01-01`,
})

const blankExpense = (year) => ({
  _id: genId(), vendor: '',
  date: `${year}-01-01`, amountIncl: '', btwRate: '21', category: 'Overig', description: '',
})

const cell = {
  background: 'var(--surface)', border: '1px solid var(--border-2)',
  borderRadius: '6px', color: 'var(--text)', padding: '6px 9px',
  fontSize: '12.5px', width: '100%', outline: 'none', boxSizing: 'border-box',
}

const fmtEUR = (n) => '€\u00a0' + Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Bedrag uit invoer/CSV: accepteert "1000.50", "1000,50", "1.000,50" en negatieve bedragen (creditnota's)
const parseAmount = (v) => {
  let t = String(v ?? '').trim().replace(/[€\s]/g, '')
  if (!t) return NaN
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else if (t.includes(',')) t = t.replace(',', '.')
  return Number(t)
}

// Lokale datum + n dagen (geen UTC-verschuiving)
const addDays = (iso, days) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d + Number(days || 0))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// Eén importregel als factuurregel → zelfde rekenregels als de rest van de app
const rowItems = (row) => [{ description: 'Geïmporteerde factuur', quantity: 1, price: parseAmount(row.amountExcl) || 0, btwRate: Number(row.btwRate) || 0, discount: null }]

// Hoogste bestaand IMP-volgnummer per jaar, zodat een nieuwe batch doornummert
const nextImpCounters = (invoices = []) => {
  const max = {}
  invoices.forEach(inv => {
    const m = /^IMP-(\d{4})-(\d+)$/.exec(String(inv.number || ''))
    if (m) max[m[1]] = Math.max(max[m[1]] || 0, Number(m[2]))
  })
  return max
}

export default function ImportView({ setInvoices, setExpenses, clients, settings, activeEntity }) {
  const [tab, setTab] = useState('invoices')
  const [year, setYear] = useState(new Date().getFullYear())
  const [invRows, setInvRows] = useState([blankInvoice(new Date().getFullYear())])
  const [expRows, setExpRows] = useState([blankExpense(new Date().getFullYear())])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [errors, setErrors] = useState([])
  const csvRef = useRef()

  // ── Year change ──────────────────────────────────────────────────────────
  const changeYear = (y) => {
    setYear(y)
    setInvRows([blankInvoice(y)])
    setExpRows([blankExpense(y)])
    setDone(null); setErrors([])
  }

  // ── Invoice row ops ──────────────────────────────────────────────────────
  const updInv = (id, k, v) => setInvRows(r => r.map(row => row._id === id ? { ...row, [k]: v } : row))
  const delInv = (id) => setInvRows(r => r.filter(row => row._id !== id))

  // ── Expense row ops ──────────────────────────────────────────────────────
  const updExp = (id, k, v) => setExpRows(r => r.map(row => row._id === id ? { ...row, [k]: v } : row))
  const delExp = (id) => setExpRows(r => r.filter(row => row._id !== id))

  // ── Totals ───────────────────────────────────────────────────────────────
  const invTotal = invRows.reduce((s, r) => s + computeInvoice(rowItems(r)).total, 0)
  const invSubtotal = invRows.reduce((s, r) => s + computeInvoice(rowItems(r)).subtotal, 0)
  const expTotal = expRows.reduce((s, r) => s + (parseAmount(r.amountIncl) || 0), 0)

  // ── Import invoices ──────────────────────────────────────────────────────
  const importInvoices = async () => {
    const errs = []
    const valid = invRows.filter((row, i) => {
      if (!row.client.trim()) { errs.push(`Rij ${i + 1}: klant is verplicht`); return false }
      if (!row.date) { errs.push(`Rij ${i + 1}: datum is verplicht`); return false }
      const amt = parseAmount(row.amountExcl)
      // Negatief mag (creditnota), 0 niet
      if (isNaN(amt) || amt === 0) { errs.push(`Rij ${i + 1}: geldig bedrag is verplicht (negatief = creditnota)`); return false }
      return true
    })
    if (errs.length) { setErrors(errs); return }
    setErrors([]); setBusy(true)

    const entityId = activeEntity?.id
    const paymentTerms = Number(settings?.invoice?.paymentTerms) || 14
    // Nummers zonder eigen nummer krijgen IMP-JJJJ-NNN, doorlopend na het hoogste
    // bestaande IMP-nummer. Dat gebeurt binnen de updater, zodat we de actuele lijst zien.
    const buildInvoices = (existing) => {
      const counters = nextImpCounters(existing)
      return valid.map((row) => {
        const isCredit = parseAmount(row.amountExcl) < 0
        const yr = row.date.slice(0, 4)
        let number = row.number
        if (!number) {
          counters[yr] = (counters[yr] || 0) + 1
          number = `IMP-${yr}-${String(counters[yr]).padStart(3, '0')}`
        }
        const matchClient = clients.find(c => c.name?.toLowerCase() === row.client.trim().toLowerCase())
        const items = rowItems(row)
        return {
          id: genId('inv'), entityId,
          number,
          clientId: matchClient?.id || null,
          clientNameOverride: matchClient ? null : row.client.trim(),
          issueDate: row.date, dueDate: addDays(row.date, paymentTerms),
          status: isCredit ? 'credit_note' : row.status,
          paidAt: !isCredit && row.status === 'paid' ? (row.paidAt || row.date) : null,
          currency: row.currency || 'EUR',
          items,
          notes: `Geïmporteerd uit archief (${yr})${isCredit ? ' — creditnota' : ''}`,
          reference: '', imported: true,
        }
      })
    }

    let newInvoices = []
    await setInvoices(prev => {
      newInvoices = buildInvoices(prev || [])
      return [...(prev || []), ...newInvoices]
    })
    if (!newInvoices.length) newInvoices = valid
    setBusy(false)
    setDone({ count: newInvoices.length, type: 'facturen' })
    setInvRows([blankInvoice(year)])
  }

  // ── Import expenses ──────────────────────────────────────────────────────
  const importExpenses = async () => {
    const errs = []
    const valid = expRows.filter((row, i) => {
      if (!row.vendor.trim()) { errs.push(`Rij ${i + 1}: leverancier is verplicht`); return false }
      if (!row.date) { errs.push(`Rij ${i + 1}: datum is verplicht`); return false }
      const amt = parseAmount(row.amountIncl)
      // Negatief mag (terugbetaling/creditnota leverancier), 0 niet
      if (isNaN(amt) || amt === 0) { errs.push(`Rij ${i + 1}: geldig bedrag is verplicht`); return false }
      return true
    })
    if (errs.length) { setErrors(errs); return }
    setErrors([]); setBusy(true)

    const entityId = activeEntity?.id
    const newExpenses = valid.map(row => {
      const amtIncl = parseAmount(row.amountIncl)
      const rate = Number(row.btwRate)
      const btwAmt = rate > 0 ? amtIncl - amtIncl / (1 + rate / 100) : 0
      return {
        id: genId('exp'), entityId,
        vendor: row.vendor.trim(), date: row.date,
        amount: amtIncl, btwAmount: Math.round(btwAmt * 100) / 100, btwRate: rate,
        category: row.category, currency: 'EUR',
        notes: row.description || `Geïmporteerd uit archief (${row.date.slice(0, 4)})`,
        status: 'processed', ledgerAccount: '',
        capturedAt: new Date().toISOString(), imported: true,
      }
    })

    await setExpenses(prev => [...(prev || []), ...newExpenses])
    setBusy(false)
    setDone({ count: newExpenses.length, type: 'kosten' })
    setExpRows([blankExpense(year)])
  }

  // ── CSV import ───────────────────────────────────────────────────────────
  const handleCSV = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return
      const sep = lines[0].includes(';') ? ';' : ','
      const headers = lines[0].split(sep).map(h => h.trim().replace(/"/g, '').toLowerCase())

      const get = (obj, ...keys) => {
        for (const k of keys) { const v = obj[k]; if (v !== undefined && v !== '') return v }
        return ''
      }

      if (tab === 'invoices') {
        const rows = lines.slice(1).map(line => {
          const cols = line.split(sep).map(c => c.trim().replace(/"/g, ''))
          const obj = {}
          headers.forEach((h, i) => { obj[h] = cols[i] || '' })
          return {
            _id: genId(),
            number: get(obj, 'nummer', 'number', 'factuurnummer', 'invoice number'),
            client: get(obj, 'klant', 'client', 'naam', 'name', 'klant naam'),
            date: get(obj, 'datum', 'date', 'factuurdatum', 'invoice date') || `${year}-01-01`,
            amountExcl: get(obj, 'bedrag excl', 'excl btw', 'bedrag_excl', 'amount_excl', 'excl. btw', 'netto'),
            btwRate: get(obj, 'btw %', 'btw%', 'btw_rate', 'btwrate', 'btw') || '21',
            currency: CURRENCIES.includes((get(obj, 'valuta', 'currency') || '').toUpperCase()) ? (get(obj, 'valuta', 'currency')).toUpperCase() : 'EUR',
            status: get(obj, 'status', 'betaalstatus').toLowerCase().includes('open') ? 'sent' : 'paid',
            paidAt: get(obj, 'betaaldatum', 'paid_at', 'betaald op') || `${year}-01-01`,
          }
        }).filter(r => r.client)
        if (rows.length > 0) setInvRows(rows)
      } else {
        const rows = lines.slice(1).map(line => {
          const cols = line.split(sep).map(c => c.trim().replace(/"/g, ''))
          const obj = {}
          headers.forEach((h, i) => { obj[h] = cols[i] || '' })
          return {
            _id: genId(),
            vendor: get(obj, 'leverancier', 'vendor', 'naam', 'name', 'supplier'),
            date: get(obj, 'datum', 'date', 'bon datum') || `${year}-01-01`,
            amountIncl: get(obj, 'bedrag incl', 'incl btw', 'bedrag_incl', 'amount', 'totaal', 'bedrag'),
            btwRate: get(obj, 'btw %', 'btw%', 'btw_rate', 'btw') || '21',
            category: get(obj, 'categorie', 'category') || 'Overig',
            description: get(obj, 'omschrijving', 'description', 'omschr', 'memo'),
          }
        }).filter(r => r.vendor)
        if (rows.length > 0) setExpRows(rows)
      }
      e.target.value = ''
      setDone(null); setErrors([])
    }
    reader.readAsText(file, 'UTF-8')
  }

  // ── Template download ────────────────────────────────────────────────────
  const downloadTemplate = () => {
    let csv, filename
    if (tab === 'invoices') {
      csv = 'Nummer;Klant;Datum;Bedrag excl;BTW %;Valuta;Status;Betaaldatum\r\n'
      csv += `${year}-001;Voorbeeld BV;${year}-03-15;1000.00;21;EUR;Betaald;${year}-03-20\r\n`
      csv += `${year}-002;Andere Klant BV;${year}-06-10;500.00;21;USD;Open;\r\n`
      filename = `facturen-template-${year}.csv`
    } else {
      csv = 'Leverancier;Datum;Bedrag incl;BTW %;Categorie;Omschrijving\r\n'
      csv += `Anthropic;${year}-02-01;60.50;21;Software/SaaS;Claude Pro abonnement\r\n`
      csv += `Albert Heijn;${year}-02-15;35.80;9;Eten & Drinken;Lunch zakelijk gesprek\r\n`
      filename = `kosten-template-${year}.csv`
    }
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const thStyle = {
    padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '500',
    color: 'var(--text-3)', whiteSpace: 'nowrap',
  }
  const tdStyle = { padding: '7px 8px' }

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ margin: '0 0 4px' }}>
            Historisch importeren
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
            Voer facturen en kosten in van voorgaande jaren — handmatig of via CSV/Excel
          </p>
        </div>
        {/* Year pills */}
        <Segmented value={year} onChange={changeYear} options={YEARS.map(y => ({ id: y, label: String(y) }))} />
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ marginBottom: '18px' }}>
        <Segmented
          value={tab}
          onChange={(t) => { setTab(t); setDone(null); setErrors([]) }}
          options={[
            { id: 'invoices', label: <><FileText size={14} /> Facturen (omzet)</> },
            { id: 'expenses', label: <><Receipt size={14} /> Kosten (bonnen)</> },
          ]}
        />
      </div>

      {/* ── Banners ── */}
      {done && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px' }}>
          <Check size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--success)', flex: 1 }}>
            {done.count} {done.type} succesvol geïmporteerd en staan nu in de app!
          </span>
          <button onClick={() => setDone(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', padding: 0, display: 'flex' }}><X size={14} /></button>
        </div>
      )}
      {errors.length > 0 && (
        <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <AlertCircle size={14} style={{ color: 'var(--danger)' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--danger)' }}>Vul alle verplichte velden in:</span>
          </div>
          {errors.map((e, i) => <div key={i} style={{ fontSize: '12px', color: 'var(--danger)', paddingLeft: '22px', lineHeight: 1.8 }}>{e}</div>)}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <input ref={csvRef} type="file" accept=".csv,.xls,.xlsx,.txt" style={{ display: 'none' }} onChange={handleCSV} />
        <Button size="sm" variant="secondary" onClick={() => csvRef.current?.click()}><Upload size={13} /> CSV importeren</Button>
        <Button size="sm" variant="secondary" onClick={downloadTemplate}><Download size={13} /> Template downloaden</Button>
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-3)', fontWeight: '500' }}>
          {tab === 'invoices'
            ? `${invRows.length} rij${invRows.length !== 1 ? 'en' : ''} · totaal ${fmtEUR(invTotal)}`
            : `${expRows.length} rij${expRows.length !== 1 ? 'en' : ''} · totaal ${fmtEUR(expTotal)}`}
        </div>
      </div>

      {/* ── FACTUREN TABLE ── */}
      {tab === 'invoices' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Factuurnummer', 'Klant *', 'Datum *', 'Bedrag excl. BTW *', 'BTW %', 'Valuta', 'Status', 'Betaaldatum', ''].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invRows.map((row, idx) => {
                  const excl = parseAmount(row.amountExcl) || 0
                  const incl = computeInvoice(rowItems(row)).total
                  return (
                    <tr key={row._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, width: '130px' }}>
                        <input style={cell} value={row.number} onChange={e => updInv(row._id, 'number', e.target.value)} placeholder={`${year}-${String(idx + 1).padStart(3, '0')}`} />
                      </td>
                      <td style={{ ...tdStyle, minWidth: '160px' }}>
                        <input
                          style={{ ...cell, borderColor: !row.client ? 'var(--warning)' : undefined }}
                          value={row.client}
                          onChange={e => updInv(row._id, 'client', e.target.value)}
                          placeholder="Klantnaam"
                          list={`cl-${row._id}`}
                        />
                        <datalist id={`cl-${row._id}`}>
                          {(clients || []).map(c => <option key={c.id} value={c.name} />)}
                        </datalist>
                      </td>
                      <td style={{ ...tdStyle, width: '145px' }}>
                        <input style={cell} type="date" value={row.date} onChange={e => updInv(row._id, 'date', e.target.value)} />
                      </td>
                      <td style={{ ...tdStyle, width: '155px' }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            className="num" style={cell}
                            type="text" inputMode="decimal"
                            value={row.amountExcl}
                            onChange={e => updInv(row._id, 'amountExcl', e.target.value)}
                            placeholder="1000.00"
                          />
                          {excl !== 0 && (
                            <div className="num" style={{ fontSize: '11px', color: excl < 0 ? 'var(--danger)' : 'var(--text-3)', marginTop: '2px' }}>
                              {excl < 0 ? 'Creditnota · ' : ''}incl. {fmtEUR(incl)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, width: '90px' }}>
                        <select style={cell} value={row.btwRate} onChange={e => updInv(row._id, 'btwRate', e.target.value)}>
                          {BTW_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, width: '90px' }}>
                        <select style={cell} value={row.currency || 'EUR'} onChange={e => updInv(row._id, 'currency', e.target.value)}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, width: '110px' }}>
                        <select style={cell} value={row.status} onChange={e => updInv(row._id, 'status', e.target.value)}>
                          <option value="paid">Betaald</option>
                          <option value="sent">Open</option>
                        </select>
                      </td>
                      <td style={{ ...tdStyle, width: '145px' }}>
                        <input
                          style={{ ...cell, opacity: row.status !== 'paid' ? 0.35 : 1 }}
                          type="date" value={row.paidAt}
                          onChange={e => updInv(row._id, 'paidAt', e.target.value)}
                          disabled={row.status !== 'paid'}
                        />
                      </td>
                      <td style={{ ...tdStyle, width: '38px' }}>
                        <button onClick={() => delInv(row._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <Button size="sm" variant="ghost" onClick={() => setInvRows(r => [...r, blankInvoice(year)])}><Plus size={13} /> Rij toevoegen</Button>
            <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: 'var(--text-3)' }}>
              <span>Excl. BTW: <strong style={{ color: 'var(--text-2)' }}><Money value={invSubtotal} /></strong></span>
              <span>Incl. BTW: <strong style={{ color: 'var(--text)' }}><Money value={invTotal} /></strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ── KOSTEN TABLE ── */}
      {tab === 'expenses' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Leverancier *', 'Datum *', 'Bedrag incl. BTW *', 'BTW %', 'Categorie', 'Omschrijving', ''].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expRows.map(row => {
                  const amtIncl = parseAmount(row.amountIncl) || 0
                  const rate = Number(row.btwRate)
                  const btwAmt = rate > 0 ? amtIncl - amtIncl / (1 + rate / 100) : 0
                  return (
                    <tr key={row._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, minWidth: '155px' }}>
                        <input
                          style={{ ...cell, borderColor: !row.vendor ? 'var(--warning)' : undefined }}
                          value={row.vendor}
                          onChange={e => updExp(row._id, 'vendor', e.target.value)}
                          placeholder="Bijv. Anthropic"
                        />
                      </td>
                      <td style={{ ...tdStyle, width: '145px' }}>
                        <input style={cell} type="date" value={row.date} onChange={e => updExp(row._id, 'date', e.target.value)} />
                      </td>
                      <td style={{ ...tdStyle, width: '155px' }}>
                        <input
                          className="num" style={cell}
                          type="text" inputMode="decimal"
                          value={row.amountIncl}
                          onChange={e => updExp(row._id, 'amountIncl', e.target.value)}
                          placeholder="60.50"
                        />
                        {amtIncl !== 0 && (
                          <div className="num" style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                            BTW: {fmtEUR(btwAmt)} · excl: {fmtEUR(amtIncl - btwAmt)}
                          </div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, width: '90px' }}>
                        <select style={cell} value={row.btwRate} onChange={e => updExp(row._id, 'btwRate', e.target.value)}>
                          {BTW_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, width: '165px' }}>
                        <select style={cell} value={row.category} onChange={e => updExp(row._id, 'category', e.target.value)}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, minWidth: '160px' }}>
                        <input style={cell} value={row.description} onChange={e => updExp(row._id, 'description', e.target.value)} placeholder="Optioneel" />
                      </td>
                      <td style={{ ...tdStyle, width: '38px' }}>
                        <button onClick={() => delExp(row._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <Button size="sm" variant="ghost" onClick={() => setExpRows(r => [...r, blankExpense(year)])}><Plus size={13} /> Rij toevoegen</Button>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              Totaal incl. BTW: <strong style={{ color: 'var(--text)' }}><Money value={expTotal} /></strong>
            </div>
          </div>
        </div>
      )}

      {/* ── Import button ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '32px' }}>
        <Button
          size="lg"
          onClick={tab === 'invoices' ? importInvoices : importExpenses}
          disabled={busy}>
          <Check size={15} />
          {busy
            ? 'Importeren…'
            : tab === 'invoices'
              ? `${invRows.length} factuur${invRows.length !== 1 ? 'en' : ''} importeren`
              : `${expRows.length} kost${expRows.length !== 1 ? 'en' : ''} importeren`
          }
        </Button>
      </div>
    </div>
  )
}
