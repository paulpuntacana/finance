// Structuur & plan van aanpak: welke bedrijfsvorm past bij Paul (Zwitserland/Wallis, DR-residency,
// Den Hartogh Solutions + SalesLobe met Stripe). Inhoud staat in ./structuurData.js zodat de
// pagina zelf alleen opmaak is en de cijfers op één plek bijgewerkt kunnen worden.
import { useState } from 'react'
import { Check, X, AlertTriangle, ChevronDown, ExternalLink, Info } from 'lucide-react'
import DATA from './structuurData'

const toneOf = (v) => ({
  good: ['var(--success-soft)', 'var(--success)'],
  ok: ['var(--warning-soft)', 'var(--warning)'],
  bad: ['var(--danger-soft)', 'var(--danger)'],
  neutral: ['var(--surface-3)', 'var(--text-2)'],
}[v] || ['var(--surface-3)', 'var(--text-2)'])

const Pill = ({ tone = 'neutral', children }) => {
  const [bg, fg] = toneOf(tone)
  return <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-medium whitespace-nowrap" style={{ background: bg, color: fg }}>{children}</span>
}

const Section = ({ title, sub, children }) => (
  <section className="space-y-3">
    <div>
      <h2 className="text-[18px] font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>{title}</h2>
      {sub && <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-3)', maxWidth: 720 }}>{sub}</p>}
    </div>
    {children}
  </section>
)

const Panel = ({ children, className = '', style }) => (
  <div className={`rounded-[14px] ${className}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', ...style }}>{children}</div>
)

const OptionCard = ({ o, open, onToggle }) => (
  <Panel className="overflow-hidden" style={o.recommended ? { boxShadow: 'inset 0 0 0 1px var(--accent)' } : undefined}>
    <button onClick={onToggle} className="w-full text-left px-5 py-4 flex items-start gap-4" style={{ background: 'none', border: 'none', cursor: 'pointer' }} aria-expanded={open}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{o.name}</span>
          {o.recommended && <Pill tone="good">Aanbevolen</Pill>}
          <Pill tone={o.verdictTone}>{o.verdict}</Pill>
        </div>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-2)', maxWidth: 760 }}>{o.summary}</p>
      </div>
      <ChevronDown size={16} style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0, marginTop: 4 }} />
    </button>
    {open && (
      <div className="px-5 pb-5 grid md:grid-cols-2 gap-x-8 gap-y-4">
        <dl className="space-y-2 text-[13px]">
          {o.facts.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[140px_1fr] gap-3">
              <dt style={{ color: 'var(--text-3)' }}>{k}</dt>
              <dd style={{ color: 'var(--text)' }}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-3 text-[13px]">
          <ul className="space-y-1.5">
            {o.pros.map(p => <li key={p} className="flex gap-2" style={{ color: 'var(--text-2)' }}><Check size={14} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 3 }} />{p}</li>)}
          </ul>
          <ul className="space-y-1.5">
            {o.cons.map(p => <li key={p} className="flex gap-2" style={{ color: 'var(--text-2)' }}><X size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 3 }} />{p}</li>)}
          </ul>
        </div>
      </div>
    )}
  </Panel>
)

export default function StructuurView() {
  const [openId, setOpenId] = useState(DATA.options.find(o => o.recommended)?.id || null)
  const [done, setDone] = useState(() => { try { return JSON.parse(localStorage.getItem('dhs_structuur_done') || '{}') } catch { return {} } })
  const toggleDone = (id) => setDone(d => {
    const next = { ...d, [id]: !d[id] }
    try { localStorage.setItem('dhs_structuur_done', JSON.stringify(next)) } catch {}
    return next
  })

  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="page-title">Structuur en plan van aanpak</h1>
        <p className="page-sub" style={{ maxWidth: 760 }}>{DATA.intro}</p>
      </div>

      {/* Advies in één oogopslag */}
      <Panel className="p-5 md:p-6" style={{ boxShadow: 'inset 3px 0 0 var(--accent)' }}>
        <div className="text-[13px] font-medium" style={{ color: 'var(--accent)' }}>Advies in het kort</div>
        <p className="text-[16px] mt-1.5 leading-relaxed" style={{ color: 'var(--text)', maxWidth: 820 }}>{DATA.verdict}</p>
        <div className="grid md:grid-cols-3 gap-3 mt-5">
          {DATA.phases.map((p, i) => (
            <div key={p.title} className="rounded-[10px] p-4" style={{ background: 'var(--surface-2)' }}>
              <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Fase {i + 1} · {p.when}</div>
              <div className="text-[14px] font-semibold mt-0.5" style={{ color: 'var(--text)' }}>{p.title}</div>
              <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>{p.text}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Section title="Waar het om draait" sub="De vragen die de keuze bepalen, en wat het antwoord voor jouw situatie is.">
        <div className="grid md:grid-cols-2 gap-3">
          {DATA.keyPoints.map(k => (
            <Panel key={k.q} className="p-4">
              <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{k.q}</div>
              <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>{k.a}</p>
            </Panel>
          ))}
        </div>
      </Section>

      <Section title="Vergelijking" sub="Bedragen zijn indicaties per jaar. Klik op een optie voor details.">
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ledger" style={{ minWidth: 880 }}>
              <thead>
                <tr>{DATA.table.columns.map((c, i) => <th key={c} className={i === 0 ? '' : ''}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {DATA.table.rows.map(r => (
                  <tr key={r[0]} onClick={() => setOpenId(DATA.options.find(o => o.name === r[0])?.id || openId)} style={{ cursor: 'pointer' }}>
                    {r.map((cell, i) => (
                      <td key={i} style={i === 0 ? { fontWeight: 600 } : { color: 'var(--text-2)', fontSize: 12.5 }}>
                        {i === r.length - 1 ? <Pill tone={cell.tone}>{cell.label}</Pill> : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <Section title="Rekenvoorbeeld" sub={DATA.calc.sub}>
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ledger" style={{ minWidth: 640 }}>
              <thead><tr>{DATA.calc.columns.map(c => <th key={c} className={c === DATA.calc.columns[0] ? '' : 'r'}>{c}</th>)}</tr></thead>
              <tbody>
                {DATA.calc.rows.map(r => (
                  <tr key={r.cells[0]} style={r.total ? { fontWeight: 600 } : undefined}>
                    {r.cells.map((c, i) => <td key={i} className={i === 0 ? '' : 'r'}>{i === 0 || i === r.cells.length - 1 ? c : <span className="money">{c}</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {DATA.calc.note && <p className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>{DATA.calc.note}</p>}
        </Panel>
      </Section>

      <Section title="Opties in detail">
        <div className="space-y-3">
          {DATA.options.map(o => <OptionCard key={o.id} o={o} open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)} />)}
        </div>
      </Section>

      <Section title="SalesLobe en Stripe" sub="Hoe je abonnementen kunt verkopen, los van waar je bedrijf staat.">
        <div className="grid md:grid-cols-3 gap-3">
          {DATA.payments.map(p => (
            <Panel key={p.name} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>{p.name}</span>
                <Pill tone={p.tone}>{p.tag}</Pill>
              </div>
              <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>{p.text}</p>
              <div className="text-[12px] mt-2" style={{ color: 'var(--text-3)' }}>{p.cost}</div>
            </Panel>
          ))}
        </div>
      </Section>

      <Section title="Checklist" sub="Vink af wat gedaan is. Je voortgang wordt in deze browser bewaard.">
        <Panel className="divide-y">
          {DATA.checklist.map(group => (
            <div key={group.title} className="p-4">
              <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text)' }}>{group.title}</div>
              <ul className="space-y-1.5">
                {group.items.map(item => {
                  const id = `${group.title}:${item}`
                  return (
                    <li key={id}>
                      <label className="flex items-start gap-2.5 text-[13px] cursor-pointer" style={{ color: done[id] ? 'var(--text-3)' : 'var(--text-2)', textDecoration: done[id] ? 'line-through' : 'none' }}>
                        <input type="checkbox" checked={!!done[id]} onChange={() => toggleDone(id)} className="mt-0.5" style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
                        {item}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </Panel>
      </Section>

      <Section title="Risico's en aandachtspunten">
        <div className="grid md:grid-cols-2 gap-3">
          {DATA.risks.map(r => (
            <Panel key={r.title} className="p-4 flex gap-3">
              <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{r.title}</div>
                <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>{r.text}</p>
              </div>
            </Panel>
          ))}
        </div>
      </Section>

      <Panel className="p-4 flex gap-3">
        <Info size={16} style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }} />
        <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
          {DATA.disclaimer}
          {DATA.sources?.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {DATA.sources.map(s => (
                <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--text-2)' }}>{s.label} <ExternalLink size={11} /></a></li>
              ))}
            </ul>
          )}
          <div className="mt-2">Bijgewerkt: {DATA.updated}</div>
        </div>
      </Panel>
    </div>
  )
}
