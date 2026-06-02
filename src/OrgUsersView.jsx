import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { UserPlus, X, AlertCircle, Eye, EyeOff, RefreshCw, Users } from 'lucide-react'

const inp = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-2)',
  borderRadius: '8px',
  color: 'var(--text)',
  padding: '9px 12px',
  fontSize: '13px',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

const th = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-3)',
  borderBottom: '1px solid var(--border)',
}

const td = {
  padding: '12px',
  fontSize: '13px',
  color: 'var(--text)',
  borderBottom: '1px solid var(--border)',
}

const ROLE_LABELS = {
  accountant: { label: 'Accountant', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  employee:   { label: 'Medewerker', color: 'var(--success)', bg: 'var(--success-soft)' },
  org_owner:  { label: 'Eigenaar',   color: 'var(--warning)', bg: 'var(--warning-soft)' },
}

// ── Modal: voeg medewerker of accountant toe ───────────────────────────────────
function AddUserModal({ orgId, onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'employee' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

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
        role: form.role,
        organization_id: orgId,
        is_active: true,
      })
    }
    setLoading(false)
    onCreated()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '460px', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={17} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Teamlid toevoegen</h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>Medewerker of accountant voor uw organisatie</p>
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
              <input
                style={{ ...inp, paddingRight: '38px' }}
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Minimaal 8 tekens"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Rol</label>
            <select style={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="employee">Medewerker — toegang tot dagelijkse administratie</option>
              <option value="accountant">Accountant — boekhouding en rapportages bekijken</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Aanmaken…' : 'Account aanmaken'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}
            >
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Hoofd component ────────────────────────────────────────────────────────────
export default function OrgUsersView({ profile }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const orgId = profile?.organization_id

  const load = async () => {
    if (!isSupabaseConfigured || !orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
    setMembers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleActive = async (member) => {
    await supabase.from('profiles').update({ is_active: !member.is_active }).eq('id', member.id)
    setMembers(ms => ms.map(m => m.id === member.id ? { ...m, is_active: !m.is_active } : m))
  }

  if (!orgId) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)' }}>
        <Users size={32} style={{ marginBottom: '12px', opacity: 0.4, display: 'block', margin: '0 auto 12px' }} />
        <p style={{ fontSize: '14px' }}>Geen organisatie gekoppeld aan uw account.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {showCreate && (
        <AddUserModal orgId={orgId} onClose={() => setShowCreate(false)} onCreated={load} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Teambeheer</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>Medewerkers en accountants van uw organisatie</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Vernieuwen
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
          >
            <UserPlus size={14} /> Teamlid toevoegen
          </button>
        </div>
      </div>

      {/* Tabel */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        {!isSupabaseConfigured ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
            Supabase niet geconfigureerd — gebruikersbeheer is niet beschikbaar.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Gebruiker', 'Rol', 'Status', 'Acties'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...td, textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
                    {loading ? 'Laden…' : 'Nog geen teamleden — klik op "Teamlid toevoegen" om te beginnen.'}
                  </td>
                </tr>
              ) : members.map(m => {
                const roleInfo = ROLE_LABELS[m.role] || { label: m.role, color: 'var(--text-3)', bg: 'var(--surface-3)' }
                const isOwner = m.role === 'org_owner'
                return (
                  <tr key={m.id} style={{ opacity: m.is_active ? 1 : 0.5 }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent)', fontSize: '13px', fontWeight: '700' }}>
                          {(m.full_name || m.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '500' }}>{m.full_name || '—'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{ background: roleInfo.bg, color: roleInfo.color, fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px' }}>
                        {roleInfo.label}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{
                        background: m.is_active ? 'var(--success-soft)' : 'var(--surface-2)',
                        color: m.is_active ? 'var(--success)' : 'var(--text-3)',
                        fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px',
                      }}>
                        {m.is_active ? 'Actief' : 'Inactief'}
                      </span>
                    </td>
                    <td style={td}>
                      {!isOwner && (
                        <button
                          onClick={() => toggleActive(m)}
                          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', color: 'var(--text-2)', fontSize: '12px', cursor: 'pointer' }}
                        >
                          {m.is_active ? 'Deactiveren' : 'Activeren'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
