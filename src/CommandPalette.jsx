// ⌘K / Ctrl+K: overal heen springen of iets zoeken (facturen, klanten, bonnen, bedragen)
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, FileText, Users, Receipt, CornerDownLeft, Plus, ArrowRight } from 'lucide-react'
import { computeInvoice } from './finance'

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const eur = (n) => '€ ' + (Number(n) || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CommandPalette({ open, onClose, navItems = [], actions = [], invoices = [], clients = [], expenses = [], onRun }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (open) { setQ(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 10) }
  }, [open])

  const results = useMemo(() => {
    const query = norm(q.trim())
    const amount = parseFloat(q.replace(/[€\s.]/g, '').replace(',', '.'))
    const isAmount = !isNaN(amount) && /\d/.test(q)
    const clientName = (id) => clients.find(c => c.id === id)?.name || ''
    const groups = []

    const acts = [...actions, ...navItems.map(n => ({ id: `nav_${n.id}`, label: `Ga naar ${n.label}`, icon: n.icon, run: { type: 'nav', tab: n.id } }))]
      .filter(a => !query || norm(a.label).includes(query))
    if (acts.length) groups.push({ label: query ? 'Acties' : 'Snel naar', items: acts.slice(0, query ? 6 : 8) })
    if (!query) return groups

    const inv = invoices
      .map(i => ({ i, total: computeInvoice(i.items).total, client: clientName(i.clientId) }))
      .filter(({ i, total, client }) =>
        norm(i.number).includes(query) || norm(i.numberAsSent).includes(query) || norm(client).includes(query) ||
        (isAmount && Math.abs(total - amount) < 0.01))
      .sort((a, b) => String(b.i.issueDate || '').localeCompare(String(a.i.issueDate || '')))
      .slice(0, 6)
      .map(({ i, total, client }) => ({
        id: `inv_${i.id}`, icon: FileText, label: `${i.number || 'Concept'} · ${client || 'geen klant'}`,
        meta: eur(total), sub: i.issueDate, run: { type: 'invoice', id: i.id },
      }))
    if (inv.length) groups.push({ label: 'Facturen', items: inv })

    const cl = clients.filter(c => norm(c.name).includes(query) || norm(c.email).includes(query)).slice(0, 4)
      .map(c => ({ id: `cl_${c.id}`, icon: Users, label: c.name, sub: c.email || c.city, run: { type: 'nav', tab: 'clients' } }))
    if (cl.length) groups.push({ label: 'Klanten', items: cl })

    const ex = expenses.filter(e => norm(e.vendor).includes(query) || norm(e.category).includes(query) || (isAmount && Math.abs(Number(e.amount || 0) - amount) < 0.01))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 5)
      .map(e => ({ id: `ex_${e.id}`, icon: Receipt, label: e.vendor || 'Bon zonder leverancier', meta: eur(e.amount), sub: e.date, run: { type: 'nav', tab: 'expenses' } }))
    if (ex.length) groups.push({ label: 'Kosten', items: ex })
    return groups
  }, [q, invoices, clients, expenses, navItems, actions])

  const flat = results.flatMap(g => g.items)
  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const run = (item) => { onRun(item.run); onClose() }
  const onKey = (e) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(flat.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); run(flat[active]) }
  }

  let idx = -1
  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center px-4" style={{ background: 'rgba(5,9,13,0.5)', backdropFilter: 'blur(3px)', paddingTop: '12vh' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Zoeken en snelle acties" className="w-full max-w-xl overflow-hidden animate-slide"
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)' }}>
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Zoek factuur, klant, leverancier of bedrag…"
            className="flex-1 h-12 text-[15px] bg-transparent"
            style={{ border: 'none', boxShadow: 'none', background: 'transparent', outline: 'none' }} />
          <kbd>esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto scrollable py-2">
          {flat.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>
              Niets gevonden voor “{q}”. Probeer een factuurnummer, klantnaam of bedrag.
            </div>
          )}
          {results.map(g => (
            <div key={g.label} className="pb-1">
              <div className="px-4 pt-2 pb-1 text-[11.5px] font-medium" style={{ color: 'var(--text-3)' }}>{g.label}</div>
              {g.items.map(item => {
                idx += 1
                const i = idx
                const Icon = item.icon || ArrowRight
                const isActive = i === active
                return (
                  <button key={item.id} data-idx={i} onMouseEnter={() => setActive(i)} onClick={() => run(item)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left"
                    style={{ background: isActive ? 'var(--accent-soft)' : 'transparent', border: 'none', cursor: 'pointer' }}>
                    <Icon size={15} style={{ color: isActive ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[13.5px]" style={{ color: 'var(--text)' }}>{item.label}</span>
                      {item.sub && <span className="block truncate text-[11.5px]" style={{ color: 'var(--text-3)' }}>{item.sub}</span>}
                    </span>
                    {item.meta && <span className="money text-[12.5px]" style={{ color: 'var(--text-2)' }}>{item.meta}</span>}
                    {isActive && <CornerDownLeft size={13} style={{ color: 'var(--text-3)' }} />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 px-4 py-2 text-[11.5px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
          <span><kbd>↑</kbd> <kbd>↓</kbd> kiezen</span><span><kbd>↵</kbd> openen</span>
          <span className="ml-auto flex items-center gap-1"><Plus size={11} /> typ “nieuw” voor snelle acties</span>
        </div>
      </div>
    </div>
  )
}
