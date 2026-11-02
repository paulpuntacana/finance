// ============================================================================
// Dashboard-infographics: geanimeerde KPI's, jaargrafiek, kostenverdeling,
// BTW-pot, debiteurenouderdom en topklanten. Alle cijfers komen uit src/finance.js.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import {
  computeInvoice, isRevenueInvoice, invoiceDate, invoiceOpenAmount, isCountedExpense, expenseNet,
  monthlySeries, buildVatReturn, yearOf,
} from './finance'

// Validated categorical slots (dataviz reference palette) — kleur volgt de entiteit, niet de rang
export const VizStyles = () => (
  <style>{`
    .viz { --viz-1:#2a78d6; --viz-2:#eb6834; --viz-3:#1baf7a; --viz-4:#eda100; --viz-5:#e87ba4; --viz-6:#6250d6; --viz-other:#9a9893; --viz-grid:rgba(0,0,0,0.06); }
    [data-theme="dark"] .viz { --viz-1:#3987e5; --viz-2:#d95926; --viz-3:#199e70; --viz-4:#c98500; --viz-5:#d55181; --viz-6:#9085e9; --viz-other:#6f6e69; --viz-grid:rgba(255,255,255,0.06); }
    @keyframes vizRise { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform:none } }
    @keyframes vizPulse { 0%,100% { opacity:1 } 50% { opacity:.45 } }
    .viz-rise { animation: vizRise .5s cubic-bezier(.2,.7,.2,1) both }
    .viz-bar { transition: width 1s cubic-bezier(.2,.7,.2,1) }
    @media (prefers-reduced-motion: reduce) { .viz-rise { animation: none } .viz-bar { transition: none } }
  `}</style>
)

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const eur = (n, dec = 0) => '€ ' + (Number(n) || 0).toLocaleString('nl-NL', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const eurShort = (v) => Math.abs(v) >= 1000 ? `€${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : `€${Math.round(v)}`
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

// Hele euro's in kasboekstijl (klein €-teken), voor grote KPI-cijfers
const moneyWhole = (v) => {
  const n = Math.round(Number(v) || 0)
  return <span className="money">{n < 0 ? '−' : ''}<span className="cur">€</span>{Math.abs(n).toLocaleString('nl-NL')}</span>
}

// Telt soepel op naar de nieuwe waarde
export const AnimatedNumber = ({ value, format = (v) => eur(v), duration = 900 }) => {
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0)
  const fromRef = useRef(0)
  useEffect(() => {
    if (prefersReducedMotion()) { setDisplay(value); return }
    const from = fromRef.current
    const start = performance.now()
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (value - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  const out = format(display)
  return typeof out === 'string' ? <span className="num">{out}</span> : out
}

const Panel = ({ children, className = '', style = {}, delay = 0 }) => (
  <div className={`viz-rise rounded-xl border ${className}`} style={{ background: 'var(--surface)', borderColor: 'var(--border)', animationDelay: `${delay}ms`, ...style }}>
    {children}
  </div>
)

const PanelTitle = ({ title, sub, right }) => (
  <div className="flex items-start justify-between gap-3 mb-3">
    <div>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</p>}
    </div>
    {right}
  </div>
)

const ChartTooltip = ({ active, payload, label, labels }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
      <div className="font-semibold mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 justify-between" style={{ minWidth: 140 }}>
          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
            {labels?.[p.dataKey] || p.name}
          </span>
          <span className="num font-medium">{eur(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── KPI-tegel met sparkline ─────────────────────────────────────────────────
const Sparkline = ({ data, dataKey, color }) => (
  <ResponsiveContainer width="100%" height={36}>
    <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#spark-${dataKey})`} isAnimationActive={!prefersReducedMotion()} animationDuration={1200} dot={false} />
    </AreaChart>
  </ResponsiveContainer>
)

export const KpiTile = ({ label, value, sub, subTone, spark, sparkKey, color, delay, onClick }) => (
  <Panel className={`p-4 overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} delay={delay}>
    <div onClick={onClick}>
      <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: 'var(--text-3)' }}>
        {color && <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />}
        {label}
      </div>
      <div className="font-semibold mt-1.5" style={{ fontSize: 24, color: 'var(--text)', lineHeight: 1.1 }}>
        <AnimatedNumber value={value} format={moneyWhole} />
      </div>
      <div className="text-[11px] mt-1" style={{ color: subTone || 'var(--text-3)' }}>{sub}</div>
      {spark && <div className="mt-2 -mx-1"><Sparkline data={spark} dataKey={sparkKey} color={color} /></div>}
    </div>
  </Panel>
)

// ── Jaargrafiek: omzet & kosten per maand + winstlijn (één as, zelfde eenheid) ──
export const YearChart = ({ series, year }) => {
  const data = series.map(m => ({ month: MONTHS[m.m], omzet: m.revenue, kosten: m.costs, winst: m.profit }))
  const labels = { omzet: 'Omzet', kosten: 'Kosten', winst: 'Resultaat' }
  return (
    <div className="viz">
      <div className="flex items-center gap-4 text-[11px] mb-2" style={{ color: 'var(--text-2)' }}>
        {[['--viz-1', 'Omzet (excl. BTW)'], ['--viz-2', 'Kosten (excl. BTW)'], ['--viz-3', 'Resultaat']].map(([v, l], i) => (
          <span key={v} className="flex items-center gap-1.5">
            <span style={{ width: i === 2 ? 14 : 9, height: i === 2 ? 2 : 9, borderRadius: 2, background: `var(${v})` }} />{l}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 6, right: 6, left: -8, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--text-3)" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--text-3)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={eurShort} width={52} />
          <Tooltip content={<ChartTooltip labels={labels} />} cursor={{ fill: 'var(--accent-soft)' }} />
          <Bar dataKey="omzet" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={900} isAnimationActive={!prefersReducedMotion()} />
          <Bar dataKey="kosten" fill="var(--viz-2)" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={900} animationBegin={150} isAnimationActive={!prefersReducedMotion()} />
          <Line type="linear" dataKey="winst" stroke="var(--viz-3)" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: 'var(--surface)' }} activeDot={{ r: 5 }} animationDuration={1300} animationBegin={300} isAnimationActive={!prefersReducedMotion()} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="sr-only">
        <table><caption>Omzet en kosten per maand {year}</caption><tbody>{data.map(d => <tr key={d.month}><td>{d.month}</td><td>{eur(d.omzet)}</td><td>{eur(d.kosten)}</td></tr>)}</tbody></table>
      </div>
    </div>
  )
}

// ── Kostenverdeling (donut, max 5 categorieën + Overig) ─────────────────────
export const CostDonut = ({ expenses, year }) => {
  const data = useMemo(() => {
    const byCat = {}
    expenses.filter(e => isCountedExpense(e) && yearOf(e.date) === year).forEach(e => {
      const k = e.category || 'Overig'
      byCat[k] = (byCat[k] || 0) + expenseNet(e)
    })
    const sorted = Object.entries(byCat).map(([name, value]) => ({ name, value })).filter(d => d.value > 0).sort((a, b) => b.value - a.value)
    const top = sorted.slice(0, 5)
    const rest = sorted.slice(5).reduce((s, d) => s + d.value, 0)
    if (rest > 0) top.push({ name: 'Overig', value: rest, other: true })
    return top
  }, [expenses, year])
  const total = data.reduce((s, d) => s + d.value, 0)
  const colors = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-6)']
  if (total === 0) return <div className="text-xs py-10 text-center" style={{ color: 'var(--muted)' }}>Nog geen verwerkte kosten in {year}</div>
  return (
    <div className="viz flex items-center gap-4">
      <div style={{ width: 132, height: 132, position: 'relative', flexShrink: 0 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={44} outerRadius={64} paddingAngle={2} stroke="var(--surface)" strokeWidth={2} animationDuration={1100} isAnimationActive={!prefersReducedMotion()}>
              {data.map((d, i) => <Cell key={d.name} fill={d.other ? 'var(--viz-other)' : colors[i]} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => active && payload?.[0] ? (
              <div className="rounded-lg px-2.5 py-1.5 text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
                {payload[0].name}: <span className="num font-semibold">{eur(payload[0].value)}</span>
              </div>
            ) : null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px]" style={{ color: 'var(--muted)' }}>totaal</div>
          <div className="text-sm font-bold" style={{ color: 'var(--text)' }}><AnimatedNumber value={total} format={eurShort} /></div>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: d.other ? 'var(--viz-other)' : colors[i] }} />
            <span className="truncate flex-1" style={{ color: 'var(--text-2)' }}>{d.name}</span>
            <span className="num" style={{ color: 'var(--text)' }}>{Math.round(d.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── BTW-pot: wat moet je dit kwartaal reserveren ────────────────────────────
export const VatPot = ({ invoices, expenses, clients }) => {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  const start = new Date(now.getFullYear(), q * 3, 1)
  const end = new Date(now.getFullYear(), q * 3 + 3, 1)
  const deadline = new Date(now.getFullYear(), q * 3 + 4, 0) // laatste dag van de maand na het kwartaal
  const vat = useMemo(() => buildVatReturn({ invoices, expenses, clients, start, end }), [invoices, expenses, clients]) // eslint-disable-line react-hooks/exhaustive-deps
  const elapsed = Math.min(1, (now - start) / (end - start))
  const daysLeft = Math.ceil((deadline - now) / 86400000)
  const R = 46, C = 2 * Math.PI * R
  const [drawn, setDrawn] = useState(prefersReducedMotion() ? elapsed : 0)
  useEffect(() => { const t = setTimeout(() => setDrawn(elapsed), 60); return () => clearTimeout(t) }, [elapsed])
  return (
    <div className="flex items-center gap-4">
      <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`Kwartaal ${Math.round(elapsed * 100)}% voorbij`}>
        <circle cx="56" cy="56" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
        <circle cx="56" cy="56" r={R} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - drawn)} transform="rotate(-90 56 56)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1)' }} />
        <text x="56" y="52" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text)">Q{q + 1}</text>
        <text x="56" y="70" textAnchor="middle" fontSize="10" fill="var(--text-3)">{Math.round(elapsed * 100)}% voorbij</text>
      </svg>
      <div className="flex-1 min-w-0">
        <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{vat.saldo >= 0 ? 'Reserveer voor BTW' : 'Verwachte teruggave'}</div>
        <div className="text-[26px] font-semibold" style={{ color: 'var(--text)', lineHeight: 1.15 }}><AnimatedNumber value={Math.abs(vat.saldo)} format={moneyWhole} /></div>
        <div className="text-[12px] mt-2 space-y-1" style={{ color: 'var(--text-3)' }}>
          <div className="flex justify-between gap-3"><span>Verschuldigd</span><span className="money" style={{ color: 'var(--text-2)' }}>{eur(vat.owed, 2)}</span></div>
          <div className="flex justify-between gap-3"><span>Voorbelasting</span><span className="money" style={{ color: 'var(--text-2)' }}>−{eur(vat.deductible, 2)}</span></div>
        </div>
        <div className="text-[12px] mt-2" style={{ color: daysLeft <= 14 ? 'var(--warning)' : 'var(--text-3)' }}>
          Aangifte uiterlijk {deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}, nog {daysLeft} dagen
        </div>
      </div>
    </div>
  )
}

// ── Debiteuren: ouderdom openstaande facturen ───────────────────────────────
export const AgingBar = ({ invoices }) => {
  const buckets = useMemo(() => {
    const b = [
      { key: 'notdue', label: 'Nog niet vervallen', value: 0, color: 'var(--viz-1)' },
      { key: '30', label: '1–30 dagen te laat', value: 0, color: 'var(--viz-4)' },
      { key: '60', label: '31–60 dagen', value: 0, color: 'var(--viz-2)' },
      { key: '90', label: '60+ dagen', value: 0, color: 'var(--danger)' },
    ]
    const today = new Date()
    invoices.forEach(i => {
      const open = invoiceOpenAmount(i)
      if (open <= 0) return
      const late = i.dueDate ? Math.floor((today - new Date(i.dueDate + 'T12:00:00')) / 86400000) : 0
      const idx = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3
      b[idx].value += open
    })
    return b
  }, [invoices])
  const total = buckets.reduce((s, b) => s + b.value, 0)
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 80); return () => clearTimeout(t) }, [])
  return (
    <div className="viz">
      <div className="text-[26px] font-semibold" style={{ color: 'var(--text)', lineHeight: 1.15 }}><AnimatedNumber value={total} format={moneyWhole} /></div>
      <div className="flex h-3 rounded-full overflow-hidden mt-2 gap-[2px]" style={{ background: 'var(--surface-2)' }}>
        {total > 0 && buckets.filter(b => b.value > 0).map(b => (
          <div key={b.key} className="viz-bar h-full" title={`${b.label}: ${eur(b.value)}`} style={{ width: ready ? `${(b.value / total) * 100}%` : '0%', background: b.color }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3">
        {buckets.map(b => (
          <div key={b.key} className="flex items-center gap-1.5 text-[11px]">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color, flexShrink: 0 }} />
            <span className="truncate" style={{ color: 'var(--text-3)' }}>{b.label}</span>
            <span className="num ml-auto" style={{ color: 'var(--text)' }}>{eurShort(b.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Topklanten (horizontale balken, geanimeerd) ─────────────────────────────
export const TopClients = ({ invoices, clients, year }) => {
  const rows = useMemo(() => {
    const by = {}
    invoices.filter(i => isRevenueInvoice(i) && yearOf(invoiceDate(i)) === year).forEach(i => {
      by[i.clientId || '—'] = (by[i.clientId || '—'] || 0) + computeInvoice(i.items).subtotal
    })
    return Object.entries(by).map(([id, v]) => ({ id, name: clients.find(c => c.id === id)?.name || 'Onbekend', value: v }))
      .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 5)
  }, [invoices, clients, year])
  const max = rows[0]?.value || 1
  const total = rows.reduce((s, r) => s + r.value, 0)
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 120); return () => clearTimeout(t) }, [])
  if (rows.length === 0) return <div className="text-xs py-6 text-center" style={{ color: 'var(--muted)' }}>Nog geen omzet in {year}</div>
  return (
    <div className="viz space-y-2.5">
      {rows.map(r => (
        <div key={r.id}>
          <div className="flex justify-between text-xs mb-1">
            <span className="truncate" style={{ color: 'var(--text-2)' }}>{r.name}</span>
            <span className="num" style={{ color: 'var(--text)' }}>{eur(r.value)} <span style={{ color: 'var(--text-3)' }}>· {Math.round(r.value / total * 100)}%</span></span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div className="viz-bar h-full rounded-full" style={{ width: ready ? `${(r.value / max) * 100}%` : '0%', background: 'var(--viz-1)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export { MONTHS, eur, eurShort }
export { monthlySeries }
