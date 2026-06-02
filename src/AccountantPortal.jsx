import { useState, useEffect } from 'react'
import { useAuth, OrgDataProvider } from './AuthProvider'
import { supabase, isSupabaseConfigured } from './supabase'
import {
  Building2, Plus, Users, ArrowRight, LogOut, Moon, Sun,
  RefreshCw, Eye, Edit3, Trash2, X, AlertCircle, Check,
  Eye as EyeOff, UserPlus, ChevronLeft, CreditCard, ShieldCheck,
} from 'lucide-react'
import App from '../factuur-app.jsx'

// ── Styles ────────────────────────────────────────────────────────────────────
const ThemeStyles = () => (
  <style>{`
    :root {
      --bg:#060b15;--bg-alt:#0a1120;--surface:#0e1628;--surface-2:#131e32;--surface-3:#19273f;
      --border:rgba(59,130,246,0.1);--border-2:rgba(59,130,246,0.18);
      --text:#dce8ff;--text-2:#7a9cc8;--text-3:#3d5c80;
      --accent:#3b82f6;--accent-soft:rgba(59,130,246,0.13);
      --success:#10b981;--success-soft:rgba(16,185,129,0.12);
      --warning:#f59e0b;--warning-soft:rgba(245,158,11,0.12);
      --danger:#ef4444;--danger-soft:rgba(239,68,68,0.12);
    }
    [data-theme="light"] {
      --bg:#f3f7ff;--bg-alt:#e8effc;--surface:#fff;--surface-2:#eef3ff;--surface-3:#e3ecfd;
      --border:rgba(30,64,175,0.08);--border-2:rgba(30,64,175,0.15);
      --text:#071432;--text-2:#395a90;--text-3:#7a9cc8;
      --accent:#2563eb;--accent-soft:rgba(37,99,235,0.09);
      --success:#059669;--success-soft:rgba(5,150,105,0.1);
      --warning:#d97706;--warning-soft:rgba(217,119,6,0.1);
      --danger:#dc2626;--danger-soft:rgba(220,38,38,0.1);
    }
    *,*::before,*::after{box-sizing:border-box;}
    body,html{background:var(--bg);color:var(--text);margin:0;padding:0;}
    *{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
    input,textarea,select{background:var(--surface)!important;color:var(--text)!important;border-color:var(--border-2)!important;}
    input::placeholder,textarea::placeholder{color:var(--text-3)!important;}
    select option{background:var(--surface);color:var(--text);}
    input:focus,textarea:focus,select:focus{outline:none!important;border-color:var(--accent)!important;box-shadow:0 0 0 3px var(--accent-soft)!important;}
  `}</style>
)

const inp = {
  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
  borderRadius: '8px', color: 'var(--text)', padding: '9px 12px',
  fontSize: '13px', width: '100%', outline: 'none', boxSizing: 'border-box',
}

const PLAN_LABELS = {
  starter: { label: 'Starter', color: 'var(--text-3)', bg: 'var(--surface-3)' },
  pro:     { label: 'Pro',     color: 'var(--accent)',  bg: 'var(--accent-soft)' },
  enterprise: { label: 'Enterprise', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
}
const ACCESS_LABELS = {
  owner:   { label: 'Eigenaar',    color: 'var(--accent)',  bg: 'var(--accent-soft)' },
  bewerk:  { label: 'Bewerken',    color: 'var(--success)', bg: 'var(--success-soft)' },
  meekijk: { label: 'Meekijken',   color: 'var(--warning)', bg: 'var(--warning-soft)' },
}

// ── Create Client Org Modal ───────────────────────────────────────────────────
function CreateOrgModal({ accountantId, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', plan: 'starter' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Naam is verplicht'); return }
    setLoading(true)
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
    const { data: org, error: err } = await supabase
      .from('organizations')
      .insert({ name: form.name.trim(), plan: form.plan, invite_code: inviteCode, managed_by: accountantId })
      .select()
      .single()
    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
    onCreated()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={17} style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Klant toevoegen</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>Nieuwe klantorganisatie aanmaken</p>
          </div>
        </div>
        {error && <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '10px 12px', color: 'var(--danger)', fontSize: '12px', marginBottom: '14px' }}>{error}</div>}
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Bedrijfsnaam</label>
            <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme BV" required />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Plan</label>
            <select style={inp} value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="submit" disabled={loading}
              style={{ flex: 1, background: 'var(--success)', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Aanmaken…' : 'Klant aanmaken'}
            </button>
            <button type="button" onClick={onClose}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Create Account Modal ──────────────────────────────────────────────────────
function CreateAccountModal({ org, onClose, onCreated }) {
  const [form, setForm] = useState({ email: '', full_name: '', password: '', access_type: 'bewerk' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.email || !form.full_name || form.password.length < 8) {
      setError('Vul alle velden in (wachtwoord minimaal 8 tekens)')
      return
    }
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
      user_metadata: { full_name: form.full_name },
    })
    if (err) { setError(err.message); setLoading(false); return }
    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: form.email,
        full_name: form.full_name,
        role: 'org_owner',
        access_type: form.access_type,
        organization_id: org.id,
        is_active: true,
      })
    }
    setLoading(false)
    onCreated()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '460px', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={17} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Account aanmaken</h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>Voor {org.name}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        {error && (
          <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '10px 12px', color: 'var(--danger)', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Volledige naam</label>
            <input style={inp} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jan de Vries" required />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>E-mailadres</label>
            <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jan@bedrijf.nl" required />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Wachtwoord</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: '38px' }} type={showPass ? 'text' : 'password'}
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimaal 8 tekens" required />
              <button type="button" onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Toegang</label>
            <select style={inp} value={form.access_type} onChange={e => setForm(f => ({ ...f, access_type: e.target.value }))}>
              <option value="owner">Eigenaar — volledige toegang (klant zelf)</option>
              <option value="bewerk">Bewerken — kan aanpassen, niet verwijderen</option>
              <option value="meekijk">Meekijken — alleen lezen</option>
            </select>
            <div style={{ marginTop: '6px', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-3)' }}>
              {form.access_type === 'meekijk' && 'Meekijkaccount: kan alles zien maar niets wijzigen. Ideaal voor klanten die hun eigen boeken willen inzien.'}
              {form.access_type === 'bewerk' && 'Bewerkaccount: kan facturen, bonnen en instellingen aanpassen. Geen toegang tot gebruikersbeheer.'}
              {form.access_type === 'owner' && 'Eigenaar: volledige toegang inclusief instellingen en teambeheer. Geef dit aan de klant zelf.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="submit" disabled={loading}
              style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Aanmaken…' : 'Account aanmaken'}
            </button>
            <button type="button" onClick={onClose}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Org Card ──────────────────────────────────────────────────────────────────
function OrgCard({ org, profiles, onEnter, onAddAccount, onDelete }) {
  const members = profiles.filter(p => p.organization_id === org.id)
  const plan = PLAN_LABELS[org.plan] || PLAN_LABELS.starter

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}>
      {/* Header */}
      <div style={{ padding: '18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={19} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)' }}>{org.name}</div>
            <div style={{ marginTop: '3px' }}>
              <span style={{ background: plan.bg, color: plan.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{plan.label}</span>
            </div>
          </div>
        </div>
        <button onClick={() => onDelete(org)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px', display: 'flex', flexShrink: 0 }}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Members */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
            Accounts ({members.length})
          </span>
          <button onClick={() => onAddAccount(org)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 8px', color: 'var(--text-3)', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
            <Plus size={11} /> Account
          </button>
        </div>
        {members.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>Nog geen accounts — voeg eigenaar of meekijker toe</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {members.map(m => {
              const acc = ACCESS_LABELS[m.access_type || 'owner']
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--accent)' }}>
                      {(m.full_name || m.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text)' }}>{m.full_name || m.email}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{m.email}</div>
                    </div>
                  </div>
                  <span style={{ background: acc.bg, color: acc.color, padding: '1px 7px', borderRadius: '8px', fontSize: '10px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {acc.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 18px', display: 'flex', gap: '8px' }}>
        <button onClick={() => onEnter(org, false)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
          <ArrowRight size={14} /> Spring erin
        </button>
        <button onClick={() => onEnter(org, true)} title="Meekijken (alleen lezen)"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer' }}>
          <Eye size={13} /> Meekijken
        </button>
      </div>
    </div>
  )
}

// ── Main AccountantPortal ─────────────────────────────────────────────────────
export default function AccountantPortal() {
  const { user, profile, signOut } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [allProfiles, setAllProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [createAccountFor, setCreateAccountFor] = useState(null) // org object
  const [activeOrg, setActiveOrg] = useState(null) // { org, readOnly }
  const [theme, setTheme] = useState(() => localStorage.getItem('dhs_theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('dhs_theme', theme)
  }, [theme])

  const load = async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    const [{ data: orgData }, { data: profileData }] = await Promise.all([
      supabase.from('organizations').select('*').eq('managed_by', user.id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])
    setOrgs(orgData || [])
    setAllProfiles(profileData || [])
    setLoading(false)
  }

  useEffect(() => { if (user?.id) load() }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (org) => {
    if (!confirm(`Klant "${org.name}" verwijderen? Dit verwijdert de organisatie maar niet de bijbehorende accounts en data.`)) return
    await supabase.from('organizations').delete().eq('id', org.id)
    setOrgs(prev => prev.filter(o => o.id !== org.id))
  }

  // When accountant has jumped into a client org, render the full app
  if (activeOrg) {
    return (
      <OrgDataProvider orgId={activeOrg.org.id} readOnly={activeOrg.readOnly}>
        <App
          accountantMode={{ orgName: activeOrg.org.id, readOnly: activeOrg.readOnly }}
          onAccountantBack={() => setActiveOrg(null)}
        />
      </OrgDataProvider>
    )
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Accountant'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }} data-theme={theme}>
      <ThemeStyles />
      {showCreateOrg && (
        <CreateOrgModal accountantId={user.id} onClose={() => setShowCreateOrg(false)} onCreated={load} />
      )}
      {createAccountFor && (
        <CreateAccountModal org={createAccountFor} onClose={() => setCreateAccountFor(null)} onCreated={load} />
      )}

      {/* Top bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '58px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: '800', fontSize: '11px', color: '#fff', letterSpacing: '-0.04em' }}>DH</span>
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)', letterSpacing: '-0.02em' }}>DHS Finance</div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>Accountant Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', marginRight: '8px' }}>{displayName}</div>
          <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '6px', display: 'flex', borderRadius: '6px' }}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={signOut}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '7px', padding: '6px 12px', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer' }}>
            <LogOut size={13} /> Uitloggen
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              Mijn klanten
            </h1>
            <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>
              {orgs.length} {orgs.length === 1 ? 'klantorganisatie' : 'klantorganisaties'} onder beheer
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={load} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 14px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Vernieuwen
            </button>
            <button onClick={() => setShowCreateOrg(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '9px 16px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              <Plus size={14} /> Klant toevoegen
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Klanten', value: orgs.length, icon: Building2, color: 'var(--accent)', soft: 'var(--accent-soft)' },
            { label: 'Accounts', value: allProfiles.filter(p => orgs.some(o => o.id === p.organization_id)).length, icon: Users, color: 'var(--success)', soft: 'var(--success-soft)' },
            { label: 'Meekijk', value: allProfiles.filter(p => p.access_type === 'meekijk' && orgs.some(o => o.id === p.organization_id)).length, icon: Eye, color: 'var(--warning)', soft: 'var(--warning-soft)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>{s.label}</span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: s.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={14} style={{ color: s.color }} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: s.color, fontFamily: 'monospace', letterSpacing: '-0.04em' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Org grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-3)' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }} />
            Laden…
          </div>
        ) : orgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px' }}>
            <Building2 size={40} style={{ color: 'var(--text-3)', margin: '0 auto 16px', display: 'block' }} />
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text)', margin: '0 0 8px' }}>Nog geen klanten</h2>
            <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: '0 0 20px' }}>
              Voeg je eerste klantorganisatie toe om te beginnen.
            </p>
            <button onClick={() => setShowCreateOrg(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px 20px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              <Plus size={14} /> Klant toevoegen
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {orgs.map(org => (
              <OrgCard
                key={org.id}
                org={org}
                profiles={allProfiles}
                onEnter={(org, readOnly) => setActiveOrg({ org, readOnly })}
                onAddAccount={setCreateAccountFor}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
