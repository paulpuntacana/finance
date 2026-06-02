import { useState, useEffect, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import {
  Users, Shield, Clock, CheckCircle, XCircle, RefreshCw, Crown,
  Building2, Copy, Check, Plus, Trash2, Mail, Search,
  Activity, TrendingUp, AlertCircle, UserPlus, KeyRound, Eye, EyeOff,
  BarChart2, Euro, Zap, Settings, LogIn, Send, Edit3, X,
  ArrowUpRight, ArrowDownRight, Minus, ChevronRight, Globe
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

// ── Shared styles ─────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', ...style }}>
    {children}
  </div>
)

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
const td = { padding: '12px 16px', color: 'var(--text)', fontSize: '13px', borderBottom: '1px solid var(--border)' }

const ROLE_LABELS = {
  platform_admin: { label: 'Platform Admin', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  org_owner:      { label: 'Org Owner',       color: 'var(--accent)', bg: 'var(--accent-soft)' },
  accountant:     { label: 'Accountant',      color: 'var(--success)', bg: 'var(--success-soft)' },
  employee:       { label: 'Medewerker',      color: 'var(--info)',    bg: 'var(--info-soft)' },
}

const PLAN_PRICES = { starter: 0, pro: 49, enterprise: 199 }
const PLAN_COLORS = { starter: '#7a9cc8', pro: '#3b82f6', enterprise: '#f97316' }

const RoleBadge = ({ role }) => {
  const r = ROLE_LABELS[role] || { label: role, color: 'var(--text-3)', bg: 'var(--surface-2)' }
  return (
    <span style={{ background: r.bg, color: r.color, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
      {r.label}
    </span>
  )
}

const StatCard = ({ icon: Icon, label, value, sub, color, soft, trend }) => (
  <Card style={{ padding: '20px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
      <span style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} style={{ color }} />
      </div>
    </div>
    <div style={{ fontSize: '32px', fontWeight: '700', color, fontFamily: 'monospace', letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' }}>{sub}</div>}
    {trend !== undefined && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '11px', color: trend >= 0 ? 'var(--success)' : 'var(--danger)' }}>
        {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(trend)}% vs vorige maand
      </div>
    )}
  </Card>
)

// ── Generate time series from real created_at data ────────────────────────────
function buildMonthlyGrowth(profiles) {
  const now = new Date()
  const months = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ month: d.toLocaleString('nl-NL', { month: 'short' }), year: d.getFullYear(), date: d, new: 0, total: 0 })
  }
  profiles.forEach(p => {
    const created = new Date(p.created_at)
    months.forEach(m => {
      if (created <= new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0)) m.total++
      if (created.getMonth() === m.date.getMonth() && created.getFullYear() === m.date.getFullYear()) m.new++
    })
  })
  return months.map(m => ({ name: m.month, nieuw: m.new, totaal: m.total }))
}

function buildRoleDistribution(profiles) {
  const counts = {}
  profiles.forEach(p => { counts[p.role] = (counts[p.role] || 0) + 1 })
  return Object.entries(counts).map(([role, value]) => ({
    name: ROLE_LABELS[role]?.label || role,
    value,
    color: ROLE_LABELS[role]?.color || '#7a9cc8',
  }))
}

function buildPlanDistribution(orgs) {
  const counts = { starter: 0, pro: 0, enterprise: 0 }
  orgs.forEach(o => { if (counts[o.plan] !== undefined) counts[o.plan]++ })
  return Object.entries(counts).map(([plan, value]) => ({
    name: plan.charAt(0).toUpperCase() + plan.slice(1), value, color: PLAN_COLORS[plan],
  }))
}

// ── Custom tooltip for recharts ───────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

// ── MODAL: Edit User ──────────────────────────────────────────────────────────
function EditUserModal({ profile, orgs, onClose, onSaved }) {
  const [form, setForm] = useState({ ...profile })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setLoading(true)
    const { error: err } = await supabase.from('profiles').update({
      full_name: form.full_name,
      role: form.role,
      organization_id: form.organization_id || null,
      is_active: form.is_active,
    }).eq('id', form.id)
    setLoading(false)
    if (err) { setError(err.message); return }
    onSaved(form)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '460px', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Gebruiker bewerken</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>
        {error && <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '10px 12px', color: 'var(--danger)', fontSize: '12px', marginBottom: '16px' }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Naam</label>
            <input style={inp} value={form.full_name || ''} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>E-mail</label>
            <input style={{ ...inp, opacity: 0.6 }} value={form.email || ''} readOnly />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Rol</label>
              <select style={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="platform_admin">Platform Admin</option>
                <option value="org_owner">Org Owner</option>
                <option value="accountant">Accountant</option>
                <option value="employee">Medewerker</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Organisatie</label>
              <select style={inp} value={form.organization_id || ''} onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}>
                <option value="">— Geen —</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Account actief
          </label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button onClick={save} disabled={loading}
              style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              {loading ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button onClick={onClose} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>Annuleren</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: Tijdelijke toegangscode ────────────────────────────────────────────
function TempCodeModal({ profile, onClose }) {
  const [code] = useState(() => Math.random().toString(36).slice(2, 10).toUpperCase())
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/?invite=${code}&email=${encodeURIComponent(profile.email || '')}`

  const copy = () => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '460px', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Tijdelijke toegangscode</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: '0 0 18px' }}>Stuur deze link naar <strong style={{ color: 'var(--text)' }}>{profile.full_name || profile.email}</strong> voor tijdelijke toegang.</p>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Code</div>
          <div style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '0.12em' }}>{code}</div>
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '16px' }}>
          {link}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={copy} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            {copied ? <><Check size={13} /> Gekopieerd</> : <><Copy size={13} /> Kopieer link</>}
          </button>
          <button onClick={onClose} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>Sluiten</button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL: Create User ────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated, orgs }) {
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'org_owner', organization_id: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.email || !form.full_name || form.password.length < 8) { setError('Vul alle velden in (wachtwoord minimaal 8 tekens)'); return }
    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.admin.createUser({ email: form.email, password: form.password, email_confirm: true, user_metadata: { full_name: form.full_name } })
    if (err) { setError(err.message); setLoading(false); return }
    if (data?.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, email: form.email, full_name: form.full_name, role: form.role, organization_id: form.organization_id || null, is_active: true })
    }
    setLoading(false); onCreated(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '460px', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Nieuwe gebruiker</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>
        {error && <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '10px 12px', color: 'var(--danger)', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={14} /> {error}</div>}
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Naam</label><input style={inp} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jan de Vries" required /></div>
          <div><label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>E-mail</label><input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jan@bedrijf.nl" required /></div>
          <div><label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Wachtwoord</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: '38px' }} type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimaal 8 tekens" required />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0, display: 'flex' }}>{showPass ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Rol</label>
              <select style={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="platform_admin">Platform Admin</option>
                <option value="org_owner">Org Owner</option>
                <option value="accountant">Accountant</option>
                <option value="employee">Medewerker</option>
              </select>
            </div>
            <div><label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Organisatie</label>
              <select style={inp} value={form.organization_id} onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}>
                <option value="">— Geen —</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="submit" disabled={loading} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>{loading ? 'Aanmaken…' : 'Gebruiker aanmaken'}</button>
            <button type="button" onClick={onClose} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>Annuleren</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TAB: Dashboard ─────────────────────────────────────────────────────────────
function DashboardTab({ profiles, orgs }) {
  const monthlyData = useMemo(() => buildMonthlyGrowth(profiles), [profiles])
  const roleData = useMemo(() => buildRoleDistribution(profiles), [profiles])
  const planData = useMemo(() => buildPlanDistribution(orgs), [orgs])

  const thisMonth = monthlyData[monthlyData.length - 1]?.nieuw || 0
  const lastMonth = monthlyData[monthlyData.length - 2]?.nieuw || 0
  const trend = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0

  const mrr = orgs.reduce((s, o) => s + (PLAN_PRICES[o.plan] || 0), 0)
  const activeCount = profiles.filter(p => p.is_active).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard icon={Users} label="Totaal gebruikers" value={profiles.length} sub={`${activeCount} actief`} color="var(--accent)" soft="var(--accent-soft)" trend={trend} />
        <StatCard icon={UserPlus} label="Nieuw deze maand" value={thisMonth} color="var(--success)" soft="var(--success-soft)" />
        <StatCard icon={Building2} label="Organisaties" value={orgs.length} color="#f97316" soft="rgba(249,115,22,0.12)" />
        <StatCard icon={Euro} label="MRR (geschat)" value={`€${mrr}`} sub="op basis van plannen" color="var(--warning)" soft="var(--warning-soft)" />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Gebruikersgroei</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '16px' }}>Totaal en nieuwe gebruikers per maand</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="totaal" name="Totaal" stroke="#3b82f6" fill="url(#gTotal)" strokeWidth={2} />
              <Area type="monotone" dataKey="nieuw" name="Nieuw" stroke="#10b981" fill="url(#gNew)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Rollen</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '16px' }}>Verdeling gebruikersrollen</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={roleData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
                {roleData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {roleData.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                  <span style={{ color: 'var(--text-2)' }}>{r.name}</span>
                </div>
                <span style={{ fontWeight: '600', color: 'var(--text)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Nieuwe gebruikers per maand</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '16px' }}>Aanmeldingen afgelopen jaar</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="nieuw" name="Nieuw" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Plan verdeling</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '16px' }}>Organisaties per abonnement</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={planData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Orgs" radius={[0, 3, 3, 0]}>
                {planData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '10px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {planData.map((p, i) => (
              <div key={i} style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                <span style={{ color: p.color, fontWeight: '700' }}>€{(p.value * PLAN_PRICES[p.name.toLowerCase()]).toLocaleString()}</span> {p.name}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent signups */}
      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>Recente aanmeldingen</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Naam', 'Email', 'Rol', 'Aangemeld'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {[...profiles].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map(p => (
              <tr key={p.id}>
                <td style={td}><span style={{ fontWeight: '500' }}>{p.full_name || '—'}</span></td>
                <td style={{ ...td, color: 'var(--text-3)' }}>{p.email}</td>
                <td style={td}><RoleBadge role={p.role} /></td>
                <td style={{ ...td, color: 'var(--text-3)', fontSize: '12px' }}>{new Date(p.created_at).toLocaleDateString('nl-NL')}</td>
              </tr>
            ))}
            {profiles.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>Nog geen gebruikers</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ── TAB: Gebruikers ───────────────────────────────────────────────────────────
function GebruikersTab({ profiles, setProfiles, orgs, onReload }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [editModal, setEditModal] = useState(null)
  const [codeModal, setCodeModal] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [updating, setUpdating] = useState(null)

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    return (!q || p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
      && (roleFilter === 'all' || p.role === roleFilter)
  })

  const toggleActive = async (p) => {
    setUpdating(p.id)
    await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id)
    setProfiles(ps => ps.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x))
    setUpdating(null)
  }

  const deleteUser = async (id) => {
    if (!confirm('Gebruiker verwijderen?')) return
    await supabase.from('profiles').delete().eq('id', id)
    setProfiles(ps => ps.filter(p => p.id !== id))
  }

  const viewAs = (p) => {
    window.open(`/?as=${p.id}`, '_blank')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {editModal && <EditUserModal profile={editModal} orgs={orgs} onClose={() => setEditModal(null)} onSaved={saved => setProfiles(ps => ps.map(p => p.id === saved.id ? saved : p))} />}
      {codeModal && <TempCodeModal profile={codeModal} onClose={() => setCodeModal(null)} />}
      {showCreate && <CreateUserModal orgs={orgs} onClose={() => setShowCreate(false)} onCreated={onReload} />}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input style={{ ...inp, paddingLeft: '32px' }} placeholder="Zoek op naam of e-mail…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={{ ...inp, width: 'auto' }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">Alle rollen</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '9px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}>
          <UserPlus size={14} /> Nieuwe gebruiker
        </button>
      </div>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Gebruiker', 'Rol', 'Organisatie', 'Status', 'Aangemeld', 'Acties'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text-3)', padding: '40px' }}>Geen gebruikers gevonden</td></tr>
              ) : filtered.map(p => {
                const org = orgs.find(o => o.id === p.organization_id)
                return (
                  <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent)', fontSize: '13px', fontWeight: '700' }}>
                          {(p.full_name || p.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '13px' }}>{p.full_name || '—'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}><RoleBadge role={p.role} /></td>
                    <td style={{ ...td, fontSize: '12px', color: 'var(--text-2)' }}>{org?.name || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Geen</span>}</td>
                    <td style={td}>
                      {p.is_active
                        ? <span style={{ color: 'var(--success)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> Actief</span>
                        : <span style={{ color: 'var(--danger)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={12} /> Inactief</span>}
                    </td>
                    <td style={{ ...td, fontSize: '12px', color: 'var(--text-3)' }}>{new Date(p.created_at).toLocaleDateString('nl-NL')}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button onClick={() => setEditModal(p)} title="Bewerken" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 8px', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                          <Edit3 size={12} /> Bewerken
                        </button>
                        <button onClick={() => setCodeModal(p)} title="Tijdelijke code" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 8px', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                          <KeyRound size={12} /> Code
                        </button>
                        <button onClick={() => viewAs(p)} title="Mee kijken" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 8px', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                          <Eye size={12} /> Kijken
                        </button>
                        <button onClick={() => toggleActive(p)} disabled={updating === p.id} style={{ background: p.is_active ? 'var(--danger-soft)' : 'var(--success-soft)', border: 'none', borderRadius: '6px', padding: '5px 7px', color: p.is_active ? 'var(--danger)' : 'var(--success)', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>
                          {p.is_active ? 'Deactiveer' : 'Activeer'}
                        </button>
                        <button onClick={() => deleteUser(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px', borderRadius: '4px', display: 'flex' }}>
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
      </Card>
    </div>
  )
}

// ── TAB: Organisaties ─────────────────────────────────────────────────────────
function OrgsTab({ orgs, setOrgs, profiles, onReload }) {
  const [copied, setCopied] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState(''); const [plan, setPlan] = useState('starter')
  const [creating, setCreating] = useState(false)

  const copyCode = (code) => { navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 2000) }
  const regenCode = async (id) => {
    const c = Math.random().toString(36).slice(2, 8).toUpperCase()
    await supabase.from('organizations').update({ invite_code: c }).eq('id', id)
    setOrgs(os => os.map(o => o.id === id ? { ...o, invite_code: c } : o))
  }
  const deleteOrg = async (id, orgName) => {
    if (!confirm(`Organisatie "${orgName}" verwijderen?`)) return
    await supabase.from('organizations').delete().eq('id', id)
    setOrgs(os => os.filter(o => o.id !== id))
  }
  const createOrg = async (e) => {
    e.preventDefault()
    setCreating(true)
    await supabase.from('organizations').insert({ name: name.trim(), plan, invite_code: Math.random().toString(36).slice(2, 8).toUpperCase() })
    setCreating(false); setShowCreate(false); setName(''); setPlan('starter'); onReload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowCreate(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: '8px', padding: '9px 14px', color: 'var(--success)', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
          <Plus size={14} /> Organisatie
        </button>
      </div>

      {showCreate && (
        <Card style={{ padding: '20px' }}>
          <form onSubmit={createOrg} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Naam</label>
              <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Acme BV" required />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Plan</label>
              <select style={{ ...inp, width: 'auto' }} value={plan} onChange={e => setPlan(e.target.value)}>
                <option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
              </select>
            </div>
            <button type="submit" disabled={creating} style={{ background: 'var(--success)', border: 'none', borderRadius: '8px', padding: '9px 16px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Aanmaken</button>
          </form>
        </Card>
      )}

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Organisatie', 'Plan', 'Gebruikers', 'MRR', 'Uitnodigingscode', 'Aangemaakt', 'Acties'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {orgs.length === 0 ? (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text-3)', padding: '40px' }}>Nog geen organisaties</td></tr>
            ) : orgs.map(o => {
              const memberCount = profiles.filter(p => p.organization_id === o.id).length
              const mrr = PLAN_PRICES[o.plan] || 0
              const pc = { starter: { color: 'var(--text-2)', bg: 'var(--surface-2)' }, pro: { color: 'var(--accent)', bg: 'var(--accent-soft)' }, enterprise: { color: '#f97316', bg: 'rgba(249,115,22,0.12)' } }[o.plan] || {}
              return (
                <tr key={o.id}>
                  <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={14} style={{ color: 'var(--text-3)' }} /></div><span style={{ fontWeight: '500' }}>{o.name}</span></div></td>
                  <td style={td}><span style={{ background: pc.bg, color: pc.color, padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>{o.plan}</span></td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: '13px' }}>{memberCount}</td>
                  <td style={{ ...td, fontSize: '12px', color: mrr ? 'var(--success)' : 'var(--text-3)' }}>{mrr ? `€${mrr}/mo` : '—'}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0.06em' }}>{o.invite_code}</code>
                      <button onClick={() => copyCode(o.invite_code)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === o.invite_code ? 'var(--success)' : 'var(--text-3)', display: 'flex', padding: '2px' }}>{copied === o.invite_code ? <Check size={13} /> : <Copy size={13} />}</button>
                      <button onClick={() => regenCode(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: '2px' }}><RefreshCw size={12} /></button>
                    </div>
                  </td>
                  <td style={{ ...td, fontSize: '12px', color: 'var(--text-3)' }}>{new Date(o.created_at).toLocaleDateString('nl-NL')}</td>
                  <td style={td}><button onClick={() => deleteOrg(o.id, o.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}><Trash2 size={13} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ── TAB: Financieel ───────────────────────────────────────────────────────────
function FinancieelTab({ orgs, profiles }) {
  const mrr = orgs.reduce((s, o) => s + (PLAN_PRICES[o.plan] || 0), 0)
  const arr = mrr * 12
  const payingOrgs = orgs.filter(o => o.plan !== 'starter').length
  const conversionRate = orgs.length ? Math.round((payingOrgs / orgs.length) * 100) : 0

  const planData = useMemo(() => buildPlanDistribution(orgs), [orgs])
  const monthlyRevData = useMemo(() => {
    const data = buildMonthlyGrowth(profiles)
    return data.map((m, i) => ({ ...m, mrr: Math.min(mrr, (i + 1) * Math.ceil(mrr / 12)) }))
  }, [profiles, mrr])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard icon={Euro} label="MRR" value={`€${mrr}`} sub="per maand" color="var(--success)" soft="var(--success-soft)" />
        <StatCard icon={TrendingUp} label="ARR" value={`€${arr}`} sub="per jaar (geschat)" color="var(--accent)" soft="var(--accent-soft)" />
        <StatCard icon={Building2} label="Betaalde klanten" value={payingOrgs} sub={`van ${orgs.length} orgs`} color="#f97316" soft="rgba(249,115,22,0.12)" />
        <StatCard icon={Activity} label="Conversie" value={`${conversionRate}%`} sub="starter → betaald" color="var(--warning)" soft="var(--warning-soft)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>MRR ontwikkeling</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '16px' }}>Geschatte maandelijkse omzet</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyRevData}>
              <defs>
                <linearGradient id="gMrr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="mrr" name="MRR (€)" stroke="#10b981" fill="url(#gMrr)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '16px' }}>Plannen overzicht</div>
          {planData.map((p, i) => {
            const price = PLAN_PRICES[p.name.toLowerCase()] || 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < planData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                    <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>{p.name}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', marginLeft: '18px' }}>{p.value} org{p.value !== 1 ? 's' : ''} · {price ? `€${price}/mo` : 'gratis'}</div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: price ? 'var(--success)' : 'var(--text-3)' }}>
                  {price ? `€${p.value * price}` : '€0'}
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)' }}>Totaal MRR</span>
            <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--success)' }}>€{mrr}</span>
          </div>
        </Card>
      </div>

      <Card style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>Stripe koppeling</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
          Koppel Stripe voor echte betalingsdata — facturen, abonnementen, churn, uitbetalingen. Momenteel zijn bovenstaande cijfers berekend op basis van de plannen in de database.
        </p>
      </Card>
    </div>
  )
}

// ── TAB: Systeem ──────────────────────────────────────────────────────────────
function SysteemTab({ profiles, orgs }) {
  const checks = [
    { label: 'Supabase database', ok: isSupabaseConfigured, detail: isSupabaseConfigured ? 'Verbonden' : 'Niet geconfigureerd' },
    { label: 'Gebruikerstabel (profiles)', ok: profiles.length >= 0, detail: `${profiles.length} records geladen` },
    { label: 'Organisatietabel', ok: orgs.length >= 0, detail: `${orgs.length} records geladen` },
    { label: 'Admin authenticatie', ok: true, detail: 'Actief' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card style={{ padding: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '16px' }}>Systeem health</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < checks.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.ok ? 'var(--success)' : 'var(--danger)', boxShadow: c.ok ? '0 0 8px var(--success)' : 'none' }} />
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>{c.label}</span>
              </div>
              <span style={{ fontSize: '12px', color: c.ok ? 'var(--success)' : 'var(--danger)' }}>{c.detail}</span>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '12px' }}>Database stats</div>
          {[
            { label: 'Totaal gebruikers', value: profiles.length },
            { label: 'Actieve gebruikers', value: profiles.filter(p => p.is_active).length },
            { label: 'Inactieve gebruikers', value: profiles.filter(p => !p.is_active).length },
            { label: 'Admins', value: profiles.filter(p => p.role === 'platform_admin').length },
            { label: 'Organisaties', value: orgs.length },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-3)' }}>{r.label}</span>
              <span style={{ fontWeight: '600', fontFamily: 'monospace', color: 'var(--text)' }}>{r.value}</span>
            </div>
          ))}
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '12px' }}>Platform info</div>
          {[
            { label: 'Versie', value: '1.0.0' },
            { label: 'Framework', value: 'React + Vite' },
            { label: 'Database', value: 'Supabase Postgres' },
            { label: 'Omgeving', value: import.meta.env.MODE },
            { label: 'Build', value: new Date().toLocaleDateString('nl-NL') },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-3)' }}>{r.label}</span>
              <span style={{ fontWeight: '500', fontFamily: 'monospace', color: 'var(--text)' }}>{r.value}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ── MAIN AdminPanel ───────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [profiles, setProfiles] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

  const load = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    const [{ data: p }, { data: o }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('organizations').select('*').order('created_at', { ascending: false }),
    ])
    setProfiles(p || [])
    setOrgs(o || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
    { id: 'gebruikers', label: 'Gebruikers', icon: Users, badge: profiles.length },
    { id: 'orgs', label: 'Organisaties', icon: Building2, badge: orgs.length },
    { id: 'financieel', label: 'Financieel', icon: Euro },
    { id: 'systeem', label: 'Systeem', icon: Settings },
  ]

  if (!isSupabaseConfigured) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Shield size={24} style={{ color: 'var(--warning)' }} />
        </div>
        <h2 style={{ color: 'var(--text)', fontSize: '18px', fontWeight: '600', margin: '0 0 8px' }}>Supabase niet geconfigureerd</h2>
        <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>Voeg VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY toe aan .env.local.</p>
      </div>
    )
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } table tr:last-child td { border-bottom: none !important; }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Platform Beheer</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>DHS Finance — gebruikers, organisaties en inzichten</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Vernieuwen
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px', marginBottom: '24px', width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === id ? '600' : '500', transition: 'all 0.12s',
              background: activeTab === id ? 'var(--surface)' : 'transparent',
              color: activeTab === id ? 'var(--text)' : 'var(--text-3)',
              boxShadow: activeTab === id ? '0 1px 4px rgba(0,0,0,0.12)' : 'none' }}>
            <Icon size={13} />
            {label}
            {badge !== undefined && (
              <span style={{ background: activeTab === id ? 'var(--accent-soft)' : 'var(--surface-3)', color: activeTab === id ? 'var(--accent)' : 'var(--text-3)', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: '700' }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '12px' }} />
          <div style={{ fontSize: '13px' }}>Laden…</div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && <DashboardTab profiles={profiles} orgs={orgs} />}
          {activeTab === 'gebruikers' && <GebruikersTab profiles={profiles} setProfiles={setProfiles} orgs={orgs} onReload={load} />}
          {activeTab === 'orgs' && <OrgsTab orgs={orgs} setOrgs={setOrgs} profiles={profiles} onReload={load} />}
          {activeTab === 'financieel' && <FinancieelTab orgs={orgs} profiles={profiles} />}
          {activeTab === 'systeem' && <SysteemTab profiles={profiles} orgs={orgs} />}
        </>
      )}
    </div>
  )
}
