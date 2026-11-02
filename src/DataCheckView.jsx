// Data-controle: toont alles wat de cijfers vervuilt (zie findDataIssues in finance.js)
// en herstelt het met één klik.
import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Wrench } from 'lucide-react'
import { findDataIssues, VAT_TREATMENTS, suggestVatTreatment } from './finance'

const SEV = {
  high: { c: 'var(--danger)', bg: 'var(--danger-soft)', label: 'Belangrijk' },
  medium: { c: 'var(--warning)', bg: 'var(--warning-soft)', label: 'Controleren' },
  low: { c: 'var(--text-3)', bg: 'var(--surface-2)', label: 'Info' },
}

export default function DataCheckView({ invoices, setInvoices, expenses, setExpenses, entries, setEntries, transactions, setTransactions, clients, purchaseInvoices = [], setPurchaseInvoices }) {
  const issues = useMemo(
    () => findDataIssues({ invoices, expenses, entries, transactions, clients, purchaseInvoices }),
    [invoices, expenses, entries, transactions, clients, purchaseInvoices]
  )

  const fix = (issue) => {
    switch (issue.type) {
      case 'duplicated_lines':
        setInvoices(prev => prev.map(i => i.id === issue.invoice.id ? { ...i, items: issue.fixedItems } : i))
        break
      case 'double_revenue': {
        const tx = transactions.find(t => t.boekEntryId === issue.entry.id)
        setEntries(prev => prev.filter(e => e.id !== issue.entry.id))
        if (tx) setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, boekEntryId: null, matchedInvoiceId: issue.invoice.id } : t))
        break
      }
      case 'wrong_vat':
        setExpenses(prev => prev.map(e => e.id === issue.expense.id ? { ...e, vatTreatment: issue.suggestion, btwRate: 0, btwAmount: 0, vatEstimated: false } : e))
        break
      case 'orphan_tx':
        setTransactions(prev => prev.map(t => t.id === issue.tx.id ? { ...t, status: 'unmatched', matchedInvoiceId: null, matchedExpenseId: null, boekEntryId: null } : t))
        break
      case 'duplicate_invoice_number':
        if (issue.sameContent && window.confirm(`Dubbele kopie van ${issue.invoices[0].number} verwijderen? (De oudste blijft staan.)`)) {
          const keep = [...issue.invoices].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))[0]
          const drop = new Set(issue.invoices.filter(i => i.id !== keep.id).map(i => i.id))
          setInvoices(prev => prev.filter(i => !drop.has(i.id)))
        }
        break
      case 'duplicate_expense':
        if (window.confirm(`Tweede kostenpost (${issue.expenses[1].date}) verwijderen?`)) {
          setExpenses(prev => prev.filter(e => e.id !== issue.expenses[1].id))
        }
        break
      case 'unbooked_purchase': {
        const p = issue.pinv
        if (issue.match) {
          setExpenses(prev => prev.map(e => e.id === issue.match.id ? { ...e, purchaseInvoiceId: p.id } : e))
          setPurchaseInvoices?.(prev => prev.map(x => x.id === p.id ? { ...x, expenseId: issue.match.id } : x))
          break
        }
        const isEur = (p.currency || 'EUR') === 'EUR'
        const treatment = Number(p.btwAmount || 0) > 0 ? 'standard' : suggestVatTreatment({ vendor: p.supplier, currency: p.currency })
        const total = Number(p.totalAmount ?? (Number(p.amount || 0) + Number(p.btwAmount || 0)))
        const id = `exp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        setExpenses(prev => [{
          id, entityId: p.entityId || null, purchaseInvoiceId: p.id,
          status: isEur && p.date ? 'processed' : 'open', source: 'purchase_invoice',
          vendor: p.supplier, date: p.date || '', currency: p.currency || 'EUR',
          originalAmount: total, exchangeRate: isEur ? 1 : null,
          amount: isEur ? total : 0,
          btwAmount: treatment === 'standard' ? Number(p.btwAmount || 0) : 0,
          btwRate: treatment === 'standard' ? Number(p.btwRate || 0) : 0,
          vatTreatment: treatment, category: p.category || '', ledgerAccount: p.ledgerCode || '',
          attachment: p.attachment || null, attachmentName: p.attachmentName || null,
          notes: `Inkoopfactuur ${p.invoiceNumber || ''}`.trim(), capturedAt: new Date().toISOString(),
        }, ...prev])
        setPurchaseInvoices?.(prev => prev.map(x => x.id === p.id ? { ...x, expenseId: id } : x))
        break
      }
      default:
    }
  }

  const fixable = (i) => ['duplicated_lines', 'double_revenue', 'wrong_vat', 'orphan_tx', 'duplicate_expense', 'unbooked_purchase'].includes(i.type) || (i.type === 'duplicate_invoice_number' && i.sameContent)
  const autoFixAll = () => {
    const safe = issues.filter(i => ['duplicated_lines', 'double_revenue', 'wrong_vat', 'orphan_tx'].includes(i.type))
    if (!safe.length || !window.confirm(`${safe.length} veilige herstelacties uitvoeren (dubbele regels, dubbele omzet, foute BTW, losse koppelingen)?`)) return
    safe.forEach(fix)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Data-controle</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Controleert alle facturen, kosten, journaalposten en banktransacties op dubbelingen en foute BTW.
          </p>
        </div>
        {issues.some(fixable) && (
          <button onClick={autoFixAll} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#fff' }}>
            <Wrench size={14} /> Herstel alle veilige punten
          </button>
        )}
      </div>

      {issues.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <CheckCircle2 size={28} style={{ color: 'var(--success)', margin: '0 auto 8px' }} />
          <div className="font-semibold" style={{ color: 'var(--text)' }}>Alles klopt</div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Geen dubbele nummers, dubbele omzet of verdachte BTW gevonden.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map(issue => {
            const s = SEV[issue.severity]
            return (
              <div key={issue.id} className="rounded-xl border p-4 flex items-start gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <AlertTriangle size={16} style={{ color: s.c, flexShrink: 0, marginTop: 2 }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.c }}>{s.label}</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{issue.title}</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{issue.detail}</div>
                  {issue.type === 'wrong_vat' && (
                    <div className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>Herstel → {VAT_TREATMENTS.find(v => v.id === issue.suggestion)?.label}</div>
                  )}
                </div>
                {fixable(issue) && (
                  <button onClick={() => fix(issue)} className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}>
                    Herstel
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
