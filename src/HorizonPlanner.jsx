import { useState, useMemo, useEffect } from 'react'
import { useLang } from './LangContext'
import {
  TrendingUp, TrendingDown, Target, Droplets, Bell, BarChart3,
  ChevronRight, AlertTriangle, CheckCircle2, Clock, Plus, Trash2,
  Zap, Users, ArrowRight, Eye, RefreshCw, Info, Calendar,
  DollarSign, Percent, Activity, Scale
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  ReferenceLine, Legend
} from 'recharts'
import { monthlySeries, buildProfitLoss, invoiceOpenAmount, isRevenueInvoice, todayISO } from './finance'
import { Button, Segmented, Money } from './ui'

const MONTHS = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']
const fmtK = n => { const v = Number(n) || 0; return Math.abs(v) >= 1000 ? `€${(v/1000).toFixed(1)}k` : `€${Math.round(v)}` }
const fmtEUR = n => '€ ' + Number(n||0).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})
const pct = (a,b) => b ? ((a-b)/b*100).toFixed(1) : '—'
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth()

// ── Design tokens (CSS variables — theme-aware) ─────────────────────────────
const C = {
  bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface-2)',
  border: 'var(--border)', borderStrong: 'var(--border-2)',
  ink: 'var(--text)', ink2: 'var(--text-2)', muted: 'var(--text-3)',
  accent: 'var(--accent)', success: 'var(--success)', warning: 'var(--warning)',
  danger: 'var(--danger)', info: 'var(--info)',
}
// Zachte achtergrond bij een token-kleur (werkt ook met var(--…))
const soft = (color, pctVal = 12) => `color-mix(in srgb, ${color} ${pctVal}%, transparent)`
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }
const mini = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }
// Tabellen gebruiken .ledger; deze objecten blijven alleen voor uitlijning
const th = {}
const td = {}
const R = 'r'
const lbl = { display: 'block', color: 'var(--text-2)', fontSize: '12.5px', fontWeight: '500', marginBottom: '6px' }
const h3s = { margin: '0 0 14px', fontSize: '13.5px', fontWeight: '600', color: 'var(--text)' }
const inp = { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '9px', color: 'var(--text)', padding: '8px 12px', fontSize: '13px', width: '100%', outline: 'none', boxSizing: 'border-box' }
// Scenario-kleuren altijd uit tokens (oude opgeslagen hex-waarden negeren)
const SCENARIO_COLORS = { base: 'var(--accent)', best: 'var(--success)', worst: 'var(--danger)' }
// Sentence case voor oude ALL-CAPS vertaalstrings
const sentence = (str = '') => { const x = String(str).toLowerCase(); return x.charAt(0).toUpperCase() + x.slice(1) }
// Omzet/kosten excl. BTW per maand, zelfde regels als Winst & verlies
const invoiceDateOf = (inv) => inv.issueDate || inv.date || null
const seriesFor = (invoices, expenses, year) => monthlySeries({ invoices, expenses, year })
const OPEN_STATUSES = ['sent', 'partial', 'overdue', 'open']
const isOpen = (inv) => isRevenueInvoice(inv) && OPEN_STATUSES.includes(inv.status) && invoiceOpenAmount(inv) > 0.005

const Badge = ({ v, positive = true }) => {
  const pos = positive ? v >= 0 : v <= 0
  return <span style={{ fontSize: '11px', fontWeight: '600', color: pos ? 'var(--success)' : 'var(--danger)', background: pos ? 'var(--success-soft)' : 'var(--danger-soft)', padding: '2px 8px', borderRadius: '20px' }}>{v >= 0 ? '▲' : '▼'} {Math.abs(v).toFixed(1)}%</span>
}

const SectionHeader = ({ icon: Icon, title, sub, color = C.accent }) => (
  <div style={{ marginBottom: '24px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: soft(color), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} style={{ color }} />
      </div>
      <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '600', color: 'var(--text)', letterSpacing: '-0.02em' }}>{title}</h2>
    </div>
    {sub && <p style={{ margin: '0 0 0 44px', color: C.muted, fontSize: '13px' }}>{sub}</p>}
  </div>
)

const StatCard = ({ label, value, sub, icon: Icon, color, delta, positive = true }) => (
  <div style={mini}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
      <span style={{ color: C.ink2, fontSize: '12.5px', fontWeight: '500' }}>{label}</span>
      <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: soft(color), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} style={{ color }} />
      </div>
    </div>
    <div className="num" style={{ fontSize: '22px', fontWeight: '650', color: C.ink, letterSpacing: '-0.02em' }}>{value}</div>
    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {delta !== undefined && <Badge v={delta} positive={positive} />}
      {sub && <span style={{ fontSize: '11px', color: C.muted }}>{sub}</span>}
    </div>
  </div>
)

const customTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: 'var(--text)' }}>
      <div style={{ color: C.muted, marginBottom: '6px', fontWeight: '600' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
          <span style={{ color: C.ink2 }}>{p.name}:</span>
          <span className="num" style={{ fontWeight: '600' }}>{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 1. BEGROTING vs REALISATIE
// ─────────────────────────────────────────────────────────────────
function BudgetSection({ invoices, expenses, horizonData, setHorizonData }) {
  const { t } = useLang()
  const [activeScenario, setActiveScenario] = useState('base')
  const [editingMonth, setEditingMonth] = useState(null)

  const scenarios = horizonData.scenarios || {
    base:  { name: 'Base case',  monthly: Array(12).fill({ omzet: 0, kosten: 0 }) },
    best:  { name: 'Best case',  monthly: Array(12).fill({ omzet: 0, kosten: 0 }) },
    worst: { name: 'Worst case', monthly: Array(12).fill({ omzet: 0, kosten: 0 }) },
  }

  const scenario = scenarios[activeScenario]

  // Realisatie per maand: factuurdatum, excl. BTW (zelfde als Winst & verlies)
  const actuals = useMemo(() => seriesFor(invoices, expenses, currentYear)
    .map(x => ({ omzet: x.revenue, kosten: x.costs })), [invoices, expenses])

  const chartData = MONTHS.map((m, i) => ({
    month: m,
    [t('horizon.actuals')]: i <= currentMonth ? Math.round(actuals[i].omzet) : null,
    [t('horizon.budget')]: Math.round(scenario.monthly[i]?.omzet || 0),
    [t('horizon.costsTarget')]: Math.round(scenario.monthly[i]?.kosten || 0),
    [t('horizon.costsAct')]: i <= currentMonth ? Math.round(actuals[i].kosten) : null,
  }))

  const ytdOmzet = actuals.slice(0, currentMonth+1).reduce((s,m) => s + m.omzet, 0)
  const ytdBegrotingOmzet = scenario.monthly.slice(0, currentMonth+1).reduce((s,m) => s + (m?.omzet||0), 0)
  const ytdKosten = actuals.slice(0, currentMonth+1).reduce((s,m) => s + m.kosten, 0)
  const ytdBegrotingKosten = scenario.monthly.slice(0, currentMonth+1).reduce((s,m) => s + (m?.kosten||0), 0)

  const saveScenarioMonth = (idx, field, val) => {
    const updated = { ...horizonData }
    if (!updated.scenarios) updated.scenarios = scenarios
    const monthly = [...(updated.scenarios[activeScenario]?.monthly || Array(12).fill({omzet:0,kosten:0}))]
    monthly[idx] = { ...monthly[idx], [field]: Number(val) }
    updated.scenarios = { ...updated.scenarios, [activeScenario]: { ...updated.scenarios[activeScenario], monthly } }
    setHorizonData(updated)
  }

  return (
    <div>
      <SectionHeader icon={Target} title={t('horizon.budgetTitle')} sub={`${currentYear} · ${t('horizon.budgetSubtitle')}`} />

      {/* Scenario switcher */}
      <div style={{ marginBottom: '20px' }}>
        <Segmented
          value={activeScenario}
          onChange={setActiveScenario}
          options={Object.entries(scenarios).map(([k, sc]) => ({
            id: k,
            label: <><span style={{ width: 8, height: 8, borderRadius: '50%', background: SCENARIO_COLORS[k] || C.accent, display: 'inline-block' }} />{sentence(sc.name)}</>,
          }))}
        />
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard label={t('horizon.revenueYtd')} value={fmtK(ytdOmzet)} icon={TrendingUp} color={C.accent}
          delta={ytdBegrotingOmzet ? parseFloat(pct(ytdOmzet, ytdBegrotingOmzet)) : undefined} sub={t('horizon.vsBudget')} />
        <StatCard label={t('horizon.costsYtd')} value={fmtK(ytdKosten)} icon={TrendingDown} color={C.danger}
          delta={ytdBegrotingKosten ? parseFloat(pct(ytdKosten, ytdBegrotingKosten)) : undefined} sub={t('horizon.vsBudget')} positive={false} />
        <StatCard label={t('horizon.profitYtd')} value={fmtK(ytdOmzet-ytdKosten)} icon={Zap} color={C.success}
          delta={ytdBegrotingOmzet > 0 ? parseFloat(pct(ytdOmzet-ytdKosten, ytdBegrotingOmzet-ytdBegrotingKosten)) : undefined} sub={t('horizon.beforeTax')} />
        <StatCard label={t('horizon.forecastYear')} value={fmtK(currentMonth > 0 ? Math.round(ytdOmzet/(currentMonth+1)*12) : 0)} icon={Target} color={C.warning} sub={t('horizon.atPace')} />
      </div>

      {/* Chart */}
      <div style={{ ...card, marginBottom: '20px' }}>
        <h3 style={h3s}>Omzet en kosten (excl. btw) — {currentYear}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtK(v)} />
            <Tooltip content={customTooltip} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
            <Bar dataKey={t('horizon.actuals')} fill="var(--accent)" radius={[4,4,0,0]} />
            <Bar dataKey={t('horizon.budget')} fill="var(--accent)" fillOpacity={0.28} radius={[4,4,0,0]} />
            <Bar dataKey={t('horizon.costsAct')} fill="var(--danger)" radius={[4,4,0,0]} />
            <Bar dataKey={t('horizon.costsTarget')} fill="var(--danger)" fillOpacity={0.25} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly budget table */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ ...h3s, margin: 0 }}>{sentence(String(t('horizon.monthlyGoals')).split(' — ')[0])} — {sentence(scenarios[activeScenario].name)}</h3>
          <span style={{ fontSize: '11px', color: C.muted }}>{t('horizon.editLink')}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ledger">
            <thead><tr>
              {['Maand','Omzet (doel)','Kosten (doel)','Marge %','Realisatie','Verschil'].map((h, hi) => <th key={h} className={hi ? R : ''}>{h}</th>)}
            </tr></thead>
            <tbody>
              {MONTHS.map((m, i) => {
                const bud = scenario.monthly[i] || {omzet:0,kosten:0}
                const act = actuals[i]
                const margin = bud.omzet > 0 ? ((bud.omzet - bud.kosten) / bud.omzet * 100).toFixed(0) : '—'
                const diff = i <= currentMonth ? act.omzet - bud.omzet : null
                const isPast = i <= currentMonth
                return (
                  <tr key={m} style={{ background: i === currentMonth ? 'var(--accent-soft)' : undefined }}>
                    <td style={td}>
                      <span style={{ fontWeight: i === currentMonth ? '700' : '400', color: i === currentMonth ? C.accent : C.ink }}>{m}</span>
                      {i === currentMonth && <span style={{ marginLeft: '6px', fontSize: '11px', background: 'var(--accent-soft)', color: C.accent, padding: '1px 6px', borderRadius: '4px' }}>Nu</span>}
                    </td>
                    <td className={R}>
                      {editingMonth === `${i}-omzet` ? (
                        <input style={{ ...inp, width: '110px' }} type="number" defaultValue={bud.omzet}
                          autoFocus onBlur={e => { saveScenarioMonth(i,'omzet',e.target.value); setEditingMonth(null) }}
                          onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                      ) : (
                        <span onClick={() => setEditingMonth(`${i}-omzet`)} className="num" style={{ cursor: 'pointer', borderBottom: `1px dashed ${C.borderStrong}` }}>{fmtK(bud.omzet)}</span>
                      )}
                    </td>
                    <td className={R}>
                      {editingMonth === `${i}-kosten` ? (
                        <input style={{ ...inp, width: '110px' }} type="number" defaultValue={bud.kosten}
                          autoFocus onBlur={e => { saveScenarioMonth(i,'kosten',e.target.value); setEditingMonth(null) }}
                          onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
                      ) : (
                        <span onClick={() => setEditingMonth(`${i}-kosten`)} className="num" style={{ cursor: 'pointer', borderBottom: `1px dashed ${C.borderStrong}` }}>{fmtK(bud.kosten)}</span>
                      )}
                    </td>
                    <td className={R}><span className="num" style={{ color: C.muted }}>{margin}%</span></td>
                    <td className={R}>{isPast ? <Money value={act.omzet} /> : <span style={{ color: C.muted }}>—</span>}</td>
                    <td className={R}>{diff !== null && bud.omzet > 0 ? <Badge v={parseFloat(pct(act.omzet, bud.omzet))} /> : <span style={{ color: C.muted }}>—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 2. LIQUIDITEITSPROGNOSE
// ─────────────────────────────────────────────────────────────────
function LiquiditySection({ invoices, expenses, horizonData, setHorizonData }) {
  const { t } = useLang()
  const startBalance = horizonData.startBalance || 0
  const monthlyFixed = horizonData.monthlyFixed || 0 // recurring monthly costs
  const btwQuarter = horizonData.btwQuarter || 0

  // Build 12-month forecast
  const forecast = useMemo(() => {
    let balance = startBalance
    const ym = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`
    const firstKey = ym(currentYear + Math.floor((currentMonth + 1) / 12), (currentMonth + 1) % 12)
    const openInv = invoices.filter(isOpen)
    return Array.from({ length: 12 }, (_, i) => {
      const m = (currentMonth + 1 + i) % 12
      const yr = currentYear + Math.floor((currentMonth + 1 + i) / 12)
      const key = ym(yr, m)

      // Verwachte ontvangst = nog openstaand bedrag (incl. BTW, het is kasstroom) van facturen
      // met vervaldatum in deze maand. Al vervallen/deze maand → in de eerste prognosemaand.
      const incoming = openInv
        .filter(inv => {
          const due = String(inv.dueDate || invoiceDateOf(inv) || '').slice(0, 7)
          if (!due) return false
          return i === 0 ? due <= key : due === key
        })
        .reduce((s, inv) => s + invoiceOpenAmount(inv), 0)

      // Fixed costs
      const outgoing = monthlyFixed

      // BTW (Q1=apr, Q2=jul, Q3=okt, Q4=jan) — rough estimate
      const btwMonths = [3,6,9,0]
      const btwOut = btwMonths.includes(m) ? btwQuarter : 0

      const net = incoming - outgoing - btwOut
      balance = balance + net
      return {
        month: MONTHS[m], balance: Math.round(balance), incoming: Math.round(incoming),
        outgoing: Math.round(outgoing + btwOut), btwOut: Math.round(btwOut), net: Math.round(net),
        isLow: balance < (horizonData.alertBalance || 5000),
      }
    })
  }, [startBalance, monthlyFixed, btwQuarter, invoices, horizonData.alertBalance])

  const minBalance = Math.min(...forecast.map(f => f.balance))
  const firstLow = forecast.findIndex(f => f.isLow)

  return (
    <div>
      <SectionHeader icon={Droplets} title={t('horizon.liquidTitle')} sub="12 maanden vooruit — wanneer loop je droog?" color={C.info} />

      {/* Config */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Huidige bankstand (€)', key: 'startBalance', placeholder: '25000' },
          { label: 'Vaste maandlasten (€)', key: 'monthlyFixed', placeholder: '3500' },
          { label: 'BTW per kwartaal (€)', key: 'btwQuarter', placeholder: '2400' },
        ].map(f => (
          <div key={f.key} style={mini}>
            <label style={lbl}>{f.label}</label>
            <input style={inp} type="number" placeholder={f.placeholder} defaultValue={horizonData[f.key] || ''}
              onBlur={e => setHorizonData({ ...horizonData, [f.key]: Number(e.target.value) })} />
          </div>
        ))}
      </div>

      {/* Alert banners */}
      {firstLow !== -1 && (
        <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} style={{ color: C.danger, flexShrink: 0 }} />
          <div>
            <strong style={{ color: C.danger, fontSize: '13px' }}>Liquiditeitsrisico in {forecast[firstLow].month}</strong>
            <div style={{ color: C.ink2, fontSize: '12px', marginTop: '2px' }}>Bankstand daalt onder je alarmgrens (€{(horizonData.alertBalance||5000).toLocaleString()}). Actie vereist.</div>
          </div>
        </div>
      )}

      {minBalance >= 0 && firstLow === -1 && (
        <div style={{ background: 'var(--success-soft)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} style={{ color: C.success, flexShrink: 0 }} />
          <div><strong style={{ color: C.success, fontSize: '13px' }}>Liquiditeit gezond</strong><span style={{ color: C.muted, fontSize: '12px', marginLeft: '8px' }}>Minimale stand: {fmtEUR(minBalance)}</span></div>
        </div>
      )}

      {/* Chart */}
      <div style={{ ...card, marginBottom: '20px' }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={forecast}>
            <defs>
              <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--info)" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="var(--info)" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtK(v)} />
            <Tooltip content={customTooltip} />
            {horizonData.alertBalance && <ReferenceLine y={horizonData.alertBalance} stroke={C.danger} strokeDasharray="4 4" label={{ value: 'Alarmgrens', fill: C.danger, fontSize: 11, position: 'right' }} />}
            <Area type="monotone" dataKey="balance" name="Bankstand" stroke="var(--info)" fill="url(#balGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div style={card}>
        <table className="ledger">
          <thead><tr>{['Maand','Bankstand','+ Inkomsten','− Lasten','BTW','Mutatie'].map((h, hi) => <th key={h} className={hi ? R : ''}>{h}</th>)}</tr></thead>
          <tbody>
            {forecast.map((f,i) => (
              <tr key={i} style={{ background: f.isLow ? 'var(--danger-soft)' : undefined }}>
                <td style={td}><span style={{ fontWeight: '500' }}>{f.month}</span>{f.isLow && <span style={{ marginLeft: '6px', fontSize: '11px', color: C.danger, background: 'var(--danger-soft)', padding: '1px 6px', borderRadius: '4px' }}>Laag</span>}</td>
                <td className={R}><span className="num" style={{ color: f.balance < 0 ? C.danger : f.isLow ? C.warning : C.ink }}>{fmtK(f.balance)}</span></td>
                <td className={R}><span className="num" style={{ color: C.success }}>+{fmtK(f.incoming)}</span></td>
                <td className={R}><span className="num" style={{ color: C.danger }}>−{fmtK(f.outgoing)}</span></td>
                <td className={R}>{f.btwOut > 0 ? <span className="num" style={{ color: C.warning }}>{fmtK(f.btwOut)}</span> : <span style={{ color: C.muted }}>—</span>}</td>
                <td className={R}><span className="num" style={{ color: f.net >= 0 ? C.success : C.danger, fontWeight:'600' }}>{f.net >= 0 ? '+' : ''}{fmtK(f.net)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 3. FINANCIËLE RATIO'S
// ─────────────────────────────────────────────────────────────────
function RatiosSection({ invoices, expenses, horizonData, setHorizonData }) {
  const ownCapital = horizonData.ownCapital || 0
  const totalCapital = horizonData.totalCapital || 0
  const currentAssets = horizonData.currentAssets || 0
  const currentLiab = horizonData.currentLiab || 0

  // Excl. BTW, op factuurdatum — identiek aan Winst & verlies
  const pl = useMemo(() => buildProfitLoss({ invoices, expenses, year: currentYear }), [invoices, expenses])
  const ytdOmzet = pl.revenue
  const ytdKosten = pl.costs
  const ytdWinst = ytdOmzet - ytdKosten

  // Ratios
  const brutomarge = ytdOmzet > 0 ? (ytdWinst / ytdOmzet * 100) : 0
  const ebitda = ytdWinst // simplified (no depreciation data)
  const ebitdaMarge = ytdOmzet > 0 ? (ebitda / ytdOmzet * 100) : 0
  const solvabiliteit = totalCapital > 0 ? (ownCapital / totalCapital * 100) : 0
  const werkkapitaal = currentAssets - currentLiab
  const currentRatio = currentLiab > 0 ? (currentAssets / currentLiab) : 0
  const roe = ownCapital > 0 ? (ytdWinst / ownCapital * 100) : 0

  const ratios = [
    { label: 'EBITDA marge', value: `${ebitdaMarge.toFixed(1)}%`, sub: `EBITDA ${fmtEUR(ebitda)}`, color: C.accent, status: ebitdaMarge > 15 ? 'good' : ebitdaMarge > 5 ? 'ok' : 'bad', bench: '>15% = sterk' },
    { label: 'Brutomarge', value: `${brutomarge.toFixed(1)}%`, sub: `${fmtEUR(ytdOmzet - ytdKosten)} winst`, color: C.warning, status: brutomarge > 30 ? 'good' : brutomarge > 15 ? 'ok' : 'bad', bench: '>30% = gezond' },
    { label: 'Solvabiliteit', value: `${solvabiliteit.toFixed(0)}%`, sub: `EV/TV verhouding`, color: C.success, status: solvabiliteit > 30 ? 'good' : solvabiliteit > 20 ? 'ok' : 'bad', bench: '>30% = solide' },
    { label: 'Current Ratio', value: currentRatio.toFixed(2), sub: `Vlottend / kortlopend`, color: C.info, status: currentRatio > 1.5 ? 'good' : currentRatio > 1 ? 'ok' : 'bad', bench: '>1.5 = veilig' },
    { label: 'Werkkapitaal', value: fmtK(werkkapitaal), sub: `Liquiditeitsbuffer`, color: C.warning, status: werkkapitaal > 0 ? 'good' : 'bad', bench: '>0 = positief' },
    { label: 'ROE', value: `${roe.toFixed(1)}%`, sub: `Rentabiliteit EV`, color: C.info, status: roe > 20 ? 'good' : roe > 10 ? 'ok' : 'bad', bench: '>20% = excellent' },
  ]

  const statusDot = s => s === 'good' ? C.success : s === 'ok' ? C.warning : C.danger

  return (
    <div>
      <SectionHeader icon={BarChart3} title="Financiële Ratio's & KPI's" sub="Investor-grade metrics op basis van jouw data" color={C.warning} />

      {/* Balance sheet inputs */}
      <div style={{ ...card, marginBottom: '20px' }}>
        <h3 style={h3s}>Balansdata invoeren (voor solvabiliteit en ratio's)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
          {[
            { label: 'Eigen vermogen (€)', key: 'ownCapital' },
            { label: 'Totaal vermogen (€)', key: 'totalCapital' },
            { label: 'Vlottende activa (€)', key: 'currentAssets' },
            { label: 'Kortlopende schulden (€)', key: 'currentLiab' },
          ].map(f => (
            <div key={f.key}>
              <label style={lbl}>{f.label}</label>
              <input style={inp} type="number" defaultValue={horizonData[f.key]||''} placeholder="0"
                onBlur={e => setHorizonData({ ...horizonData, [f.key]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
      </div>

      {/* Ratios grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
        {ratios.map(r => (
          <div key={r.label} style={{ ...mini, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: C.ink2, fontSize: '12.5px', fontWeight: '500' }}>{r.label}</span>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusDot(r.status) }} />
            </div>
            <div className="num" style={{ fontSize: '26px', fontWeight: '650', color: r.color, letterSpacing: '-0.02em' }}>{r.value}</div>
            <div style={{ marginTop: '6px', fontSize: '11px', color: C.muted }}>{r.sub}</div>
            <div style={{ marginTop: '4px', fontSize: '10px', color: statusDot(r.status), background: soft(statusDot(r.status)), padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>{r.bench}</div>
          </div>
        ))}
      </div>

      {/* SaaS metrics */}
      <div style={{ ...card }}>
        <h3 style={h3s}>SaaS / dienstverlener KPI's</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
          {[
            { label: 'MRR (doel)', key: 'mrr', placeholder: '5000', icon: '↻' },
            { label: 'ARR (doel)', key: 'arr', placeholder: '60000', icon: '📅' },
            { label: 'CAC (gem.)', key: 'cac', placeholder: '250', icon: '🎯' },
            { label: 'LTV (gem.)', key: 'ltv', placeholder: '2400', icon: '💡' },
            { label: 'Churn % /mnd', key: 'churn', placeholder: '2.5', icon: '📉' },
            { label: 'LTV/CAC ratio', key: '_ltvcac', icon: '🏆', computed: horizonData.cac > 0 ? (horizonData.ltv / horizonData.cac).toFixed(1) : '—', readonly: true },
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ ...lbl, marginBottom: 0 }}>{f.label}</label>
              {f.readonly ? (
                <div style={{ ...inp, color: horizonData.ltv/horizonData.cac > 3 ? C.success : C.warning, fontFamily: 'var(--font-num)', fontSize: '16px', fontWeight: '650' }}>{f.computed} {parseFloat(f.computed) > 3 ? '✓ Goed' : '↗ Verbeteren'}</div>
              ) : (
                <input style={inp} type="number" placeholder={f.placeholder} defaultValue={horizonData[f.key]||''}
                  onBlur={e => setHorizonData({ ...horizonData, [f.key]: Number(e.target.value) })} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 4. AGING DEBITEUREN
// ─────────────────────────────────────────────────────────────────
function AgingSection({ invoices, clients }) {
  const { t } = useLang()
  const aged = useMemo(() => {
    const buckets = { '0-30': [], '31-60': [], '61-90': [], '90+': [] }
    const t0 = new Date(todayISO() + 'T12:00:00')
    invoices.filter(isOpen).forEach(inv => {
      const dueIso = String(inv.dueDate || invoiceDateOf(inv) || '').slice(0, 10)
      if (!dueIso) return
      const days = Math.round((t0 - new Date(dueIso + 'T12:00:00')) / 86400000)
      if (days < 0) return // not yet due
      const client = clients.find(c => c.id === inv.clientId)
      // Openstaand bedrag incl. BTW (wat de klant nog moet betalen), deelbetalingen eraf
      const total = invoiceOpenAmount(inv)
      const entry = { inv, client, days, total }
      if (days <= 30) buckets['0-30'].push(entry)
      else if (days <= 60) buckets['31-60'].push(entry)
      else if (days <= 90) buckets['61-90'].push(entry)
      else buckets['90+'].push(entry)
    })
    return buckets
  }, [invoices, clients])

  const bucketColors = { '0-30': C.success, '31-60': C.warning, '61-90': C.danger, '90+': C.danger }
  const totals = Object.fromEntries(Object.entries(aged).map(([k,v]) => [k, v.reduce((s,e) => s+e.total, 0)]))
  const grandTotal = Object.values(totals).reduce((a,b) => a+b, 0)

  const chartData = Object.entries(aged).map(([k,v]) => ({
    bucket: k, bedrag: Math.round(totals[k]), count: v.length
  }))

  return (
    <div>
      <SectionHeader icon={Clock} title={t('horizon.agingTitle')} sub="Hoelang staat geld open — per klant, per bucket" color={C.warning} />

      {grandTotal === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '48px', color: C.muted }}>
          <CheckCircle2 size={36} style={{ margin: '0 auto 12px', display: 'block', color: C.success }} />
          <p style={{ margin: 0 }}>Geen openstaande facturen. Uitstekend!</p>
        </div>
      ) : (
        <>
          {/* Overview cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
            {Object.entries(aged).map(([k,v]) => (
              <div key={k} style={{ ...mini, borderLeft: `3px solid ${bucketColors[k]}` }}>
                <div style={{ color: bucketColors[k], fontSize: '12.5px', fontWeight: '500', marginBottom: '6px' }}>{k} dagen</div>
                <div style={{ fontSize: '20px', fontWeight: '650', color: C.ink }}><Money value={totals[k]} /></div>
                <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>{v.length} factuur{v.length !== 1 ? 'en' : ''}</div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div style={{ ...card, marginBottom: '20px' }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtK(v)} />
                <YAxis dataKey="bucket" type="category" tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} />
                <Bar dataKey="bedrag" name="Openstaand" fill={C.accent} radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          {Object.entries(aged).filter(([,v]) => v.length > 0).map(([bucket, items]) => (
            <div key={bucket} style={{ ...card, marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: bucketColors[bucket] }} />
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: C.ink }}>{bucket} dagen — <Money value={totals[bucket]} /></h3>
              </div>
              <table className="ledger">
                <thead><tr>{['Klant','Factuur','Vervaldatum','Dagen te laat','Openstaand'].map((h, hi) => <th key={h} className={hi >= 3 ? R : ''}>{h}</th>)}</tr></thead>
                <tbody>
                  {[...items].sort((a,b) => b.total - a.total).map((e,i) => (
                    <tr key={i}>
                      <td style={td}><span style={{ fontWeight: '500' }}>{e.client?.name || '—'}</span></td>
                      <td style={td}><span className="num" style={{ fontSize: '12px' }}>{e.inv.number}</span></td>
                      <td style={td}><span style={{ color: C.muted }}>{e.inv.dueDate?.split('-').reverse().join('-') || '—'}</span></td>
                      <td className={R}><span className="num" style={{ color: bucketColors[bucket], fontWeight: '600' }}>{e.days}d</span></td>
                      <td className={R}><Money value={e.total} style={{ fontWeight: 600 }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// 5. ALERTS
// ─────────────────────────────────────────────────────────────────
function AlertsSection({ invoices, expenses, horizonData, setHorizonData }) {
  const { t } = useLang()
  const [newAlert, setNewAlert] = useState({ type: 'cashflow', threshold: '', message: '' })

  const alerts = horizonData.alerts || []

  // Omzet (excl. BTW, factuurdatum) van deze maand en de twee maanden ervoor — [nu, -1, -2]
  const ytdOmzet3months = useMemo(() => {
    const cur = seriesFor(invoices, [], currentYear)
    const prev = seriesFor(invoices, [], currentYear - 1)
    return [0,1,2].map(offset => {
      const m = currentMonth - offset
      return m >= 0 ? cur[m].revenue : prev[12 + m].revenue
    })
  }, [invoices])
  const ytdPL = useMemo(() => buildProfitLoss({ invoices, expenses, year: currentYear }), [invoices, expenses])

  const triggered = useMemo(() => {
    const active = []
    alerts.forEach(a => {
      if (a.type === 'omzet_daling') {
        const declining = ytdOmzet3months[0] < ytdOmzet3months[1] && ytdOmzet3months[1] < ytdOmzet3months[2]
        if (declining) active.push({ ...a, severity: 'warning', message: `Omzet daalt 3 maanden op rij (${[...ytdOmzet3months].reverse().map(v => fmtK(v)).join(' → ')})` })
      }
      if (a.type === 'cashflow' && horizonData.startBalance < Number(a.threshold)) {
        active.push({ ...a, severity: 'danger', message: `Bankstand (${fmtEUR(horizonData.startBalance)}) onder alarmgrens ${fmtEUR(a.threshold)}` })
      }
      if (a.type === 'kosten_pct') {
        const ytdO = ytdPL.revenue
        const ytdK = ytdPL.costs
        const pctVal = ytdO > 0 ? ytdK/ytdO*100 : 0
        if (pctVal > Number(a.threshold)) active.push({ ...a, severity: 'warning', message: `Kosten zijn ${pctVal.toFixed(1)}% van omzet (grens: ${a.threshold}%)` })
      }
    })
    return active
  }, [alerts, ytdOmzet3months, ytdPL, horizonData.startBalance])

  const addAlert = () => {
    if (!newAlert.type) return
    setHorizonData({ ...horizonData, alerts: [...alerts, { ...newAlert, id: Date.now(), active: true }] })
    setNewAlert({ type: 'cashflow', threshold: '', message: '' })
  }

  const removeAlert = id => setHorizonData({ ...horizonData, alerts: alerts.filter(a => a.id !== id) })

  return (
    <div>
      <SectionHeader icon={Bell} title={t('horizon.alertsTitle')} sub="Proactieve meldingen op basis van jouw drempelwaarden" color={C.warning} />

      {triggered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {triggered.map((a,i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: a.severity === 'danger' ? 'var(--danger-soft)' : 'var(--warning-soft)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px' }}>
              <AlertTriangle size={17} style={{ color: a.severity === 'danger' ? C.danger : C.warning, flexShrink: 0, marginTop: '1px' }} />
              <div>
                <strong style={{ color: a.severity === 'danger' ? C.danger : C.warning, fontSize: '13px' }}>{a.message}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {triggered.length === 0 && alerts.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--success-soft)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px' }}>
          <CheckCircle2 size={17} style={{ color: C.success }} />
          <span style={{ color: C.success, fontSize: '13px', fontWeight: '500' }}>Alle alerts zijn in orde — geen drempelwaarden overschreden.</span>
        </div>
      )}

      {/* Add alert */}
      <div style={{ ...card, marginBottom: '20px' }}>
        <h3 style={h3s}>Alert toevoegen</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Type</label>
            <select style={inp} value={newAlert.type} onChange={e => setNewAlert(a => ({ ...a, type: e.target.value }))}>
              <option value="cashflow">Bankstand onder € X</option>
              <option value="omzet_daling">Omzetdaling 3 maanden op rij</option>
              <option value="kosten_pct">Kosten boven X% van omzet</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Drempelwaarde</label>
            <input style={inp} type="number" placeholder={newAlert.type === 'omzet_daling' ? 'Geen getal nodig' : newAlert.type === 'kosten_pct' ? '60' : '5000'}
              value={newAlert.threshold} onChange={e => setNewAlert(a => ({ ...a, threshold: e.target.value }))} />
          </div>
          <Button onClick={addAlert}><Plus size={14} /> Alert toevoegen</Button>
        </div>
      </div>

      {/* Alert list */}
      {alerts.length > 0 ? (
        <div style={card}>
          <table className="ledger">
            <thead><tr>{['Type','Drempelwaarde','Status',''].map((h, hi) => <th key={hi} className={hi === 1 || hi === 3 ? R : ''}>{h}</th>)}</tr></thead>
            <tbody>
              {alerts.map(a => {
                const isTriggered = triggered.some(t => t.id === a.id)
                return (
                  <tr key={a.id}>
                    <td style={td}>{a.type === 'cashflow' ? 'Bankstand' : a.type === 'omzet_daling' ? 'Omzetdaling' : 'Kostenratio'}</td>
                    <td className={R}>{a.type === 'omzet_daling' ? '—' : a.type === 'kosten_pct' ? <span className="num">{a.threshold}%</span> : <Money value={a.threshold} />}</td>
                    <td style={td}>{isTriggered ? <span style={{ color: C.danger, fontWeight: '600', fontSize: '12px' }}>Getriggerd</span> : <span style={{ color: C.success, fontSize: '12px' }}>OK</span>}</td>
                    <td className={R}><Button size="sm" variant="ghost" onClick={() => removeAlert(a.id)}><Trash2 size={13} /> Verwijder</Button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ ...card, textAlign: 'center', padding: '40px', color: C.muted }}>
          <Bell size={28} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
          <p style={{ margin: 0 }}>{t('horizon.noAlerts')}</p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN HorizonPlanner component
// ─────────────────────────────────────────────────────────────────
export default function HorizonPlanner({ invoices, expenses, clients, horizonData, setHorizonData }) {
  const { t } = useLang()
  const [tab, setTab] = useState('begroting')
  const now = new Date()

  const TABS = [
    { id: 'begroting',  label: t('horizon.tabBudget'),    icon: Target,    color: C.accent },
    { id: 'liquiditeit',label: t('horizon.tabLiquidity'), icon: Droplets,  color: C.info },
    { id: 'ratios',     label: t('horizon.tabRatios'),    icon: BarChart3, color: C.warning },
    { id: 'aging',      label: t('horizon.tabAging'),     icon: Clock,     color: C.warning },
    { id: 'alerts',     label: t('horizon.tabAlerts'),    icon: Bell,      color: C.success },
  ]

  // Jaarforecast
  // Excl. BTW, op factuurdatum — zelfde cijfers als Winst & verlies
  const plYtd = useMemo(() => buildProfitLoss({ invoices, expenses, year: currentYear }), [invoices, expenses])
  const ytdOmzet = plYtd.revenue
  const ytdKosten = plYtd.costs
  const maanden = currentMonth + 1
  const forecastOmzet = maanden > 0 ? Math.round(ytdOmzet / maanden * 12) : 0
  const forecastWinst = maanden > 0 ? Math.round((ytdOmzet - ytdKosten) / maanden * 12) : 0

  const hd = horizonData || {}
  const setHD = setHorizonData

  return (
    <div style={{ color: 'var(--text)' }}>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="page-title" style={{ margin: '0 0 4px' }}>
              HorizonPlanner
            </h1>
            <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>{t('horizon.subtitle')}</p>
          </div>
          {/* Live jaarforecast banner */}
          <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border-2)', borderRadius: '12px', padding: '12px 18px', display: 'flex', gap: '24px' }}>
            {[
              { label: t('horizon.forecastRevenue'), value: fmtK(forecastOmzet), color: C.accent },
              { label: t('horizon.forecastProfit'), value: fmtK(forecastWinst), color: C.success },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: '12px', color: C.ink2, fontWeight: '500', marginBottom: '3px' }}>{f.label} {currentYear}</div>
                <div className="num" style={{ fontSize: '18px', fontWeight: '650', color: f.color }}>{f.value}</div>
              </div>
            ))}
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: '20px' }}>
              <div style={{ fontSize: '12px', color: C.ink2, fontWeight: '500', marginBottom: '3px' }}>{t('horizon.progressLabel')}</div>
              <div className="num" style={{ fontSize: '18px', fontWeight: '650', color: C.warning }}>{Math.round(currentMonth/12*100)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{ marginBottom: '28px' }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={TABS.map(tb => ({ id: tb.id, label: <><tb.icon size={14} style={{ color: tab === tb.id ? tb.color : undefined }} />{tb.label}</> }))}
        />
      </div>

      {/* Content */}
      {tab === 'begroting'   && <BudgetSection    invoices={invoices} expenses={expenses} horizonData={hd} setHorizonData={setHD} />}
      {tab === 'liquiditeit' && <LiquiditySection invoices={invoices} expenses={expenses} horizonData={hd} setHorizonData={setHD} />}
      {tab === 'ratios'      && <RatiosSection    invoices={invoices} expenses={expenses} horizonData={hd} setHorizonData={setHD} />}
      {tab === 'aging'       && <AgingSection     invoices={invoices} clients={clients} />}
      {tab === 'alerts'      && <AlertsSection    invoices={invoices} expenses={expenses} horizonData={hd} setHorizonData={setHD} />}

      <style>{`
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        table tr:last-child td { border-bottom: none !important; }
      `}</style>
    </div>
  )
}
