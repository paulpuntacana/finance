import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import AdminPanel from './AdminPanel'
import { Shield, Eye, EyeOff, LogOut, AlertCircle } from 'lucide-react'

// ── Styles shared within the admin shell ─────────────────────────────────────
const s = {
  bg: '#060b15',
  surface: '#0e1628',
  surface2: '#131e32',
  border: 'rgba(59,130,246,0.15)',
  border2: 'rgba(59,130,246,0.25)',
  text: '#dce8ff',
  text2: '#7a9cc8',
  text3: '#3d5c80',
  accent: '#3b82f6',
  accentSoft: 'rgba(59,130,246,0.13)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239,68,68,0.12)',
  success: '#10b981',
  successSoft: 'rgba(16,185,129,0.12)',
}

const inp = {
  background: s.surface2,
  border: `1px solid ${s.border2}`,
  borderRadius: 8,
  color: s.text,
  padding: '10px 13px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

// ── Admin Login Page ──────────────────────────────────────────────────────────
function AdminLoginPage({ onLogin, onDirectAccess, loading, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 20px rgba(59,130,246,0.35)' }}>
            <Shield size={24} color="#fff" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: s.text, letterSpacing: '-0.02em' }}>DHS Admin</div>
          <div style={{ fontSize: 13, color: s.text3, marginTop: 4 }}>Platform beheer</div>
        </div>

        {/* Card */}
        <div style={{ background: s.surface, border: `1px solid ${s.border2}`, borderRadius: 16, padding: '32px 28px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

          {error && (
            <div style={{ background: s.dangerSoft, border: `1px solid ${s.danger}`, borderRadius: 8, padding: '10px 12px', color: s.danger, fontSize: 12, marginBottom: 18, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Tijdelijke directe toegang — verwijder dit blok zodra Supabase actief is */}
          <button
            onClick={onDirectAccess}
            style={{ width: '100%', background: s.accent, border: 'none', borderRadius: 9, padding: '12px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 20 }}
          >
            Direct toegang (tijdelijk)
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: s.border }} />
            <span style={{ fontSize: 11, color: s.text3 }}>of inloggen met Supabase</span>
            <div style={{ flex: 1, height: 1, background: s.border }} />
          </div>

          <form onSubmit={e => { e.preventDefault(); onLogin(email, password) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: s.text2, marginBottom: 6 }}>E-mailadres</label>
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@denhartoghsolutions.com" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: s.text2, marginBottom: 6 }}>Wachtwoord</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inp, paddingRight: 40 }} type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: s.text3, cursor: 'pointer', display: 'flex', padding: 0 }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              style={{ background: s.surface2, border: `1px solid ${s.border2}`, borderRadius: 9, padding: '10px', color: s.text2, fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Inloggen…' : 'Inloggen met account'}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${s.border}`, textAlign: 'center', fontSize: 11, color: s.text3 }}>
            Terug naar de app?{' '}
            <a href="/" style={{ color: s.accent, textDecoration: 'none' }}>Ga naar DHS Finance</a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Admin Dashboard wrapper ───────────────────────────────────────────────────
function AdminDashboard({ profile, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: s.bg, fontFamily: 'Inter, -apple-system, sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: s.surface, borderBottom: `1px solid ${s.border}`, padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={15} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: s.text, letterSpacing: '-0.01em' }}>DHS Admin</span>
          <span style={{ background: s.accentSoft, color: s.accent, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, letterSpacing: '0.04em' }}>PLATFORM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: s.text2 }}>{profile?.full_name || profile?.email}</span>
          <button
            onClick={onLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: s.surface2, border: `1px solid ${s.border}`, borderRadius: 8, padding: '6px 12px', color: s.text2, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            <LogOut size={13} /> Uitloggen
          </button>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, background: s.accentSoft, border: `1px solid ${s.accent}22`, borderRadius: 8, padding: '6px 12px', color: s.accent, fontSize: 12, textDecoration: 'none', fontWeight: 500 }}>
            ← Terug naar app
          </a>
        </div>
      </div>

      {/* Content */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 28px' }}>
        {/* Inject CSS vars so AdminPanel styles work */}
        <style>{`
          :root {
            --bg:#060b15;--bg-alt:#0a1120;--surface:#0e1628;--surface-2:#131e32;--surface-3:#19273f;
            --border:rgba(59,130,246,0.1);--border-2:rgba(59,130,246,0.18);--border-3:rgba(59,130,246,0.32);
            --border-strong:rgba(59,130,246,0.18);--text:#dce8ff;--text-2:#7a9cc8;--text-3:#3d5c80;
            --accent:#3b82f6;--accent-2:#60a5fa;--accent-hover:#2563eb;--accent-soft:rgba(59,130,246,0.13);
            --accent-glow:rgba(59,130,246,0.25);--success:#10b981;--success-soft:rgba(16,185,129,0.12);
            --warning:#f59e0b;--warning-soft:rgba(245,158,11,0.12);--danger:#ef4444;--danger-soft:rgba(239,68,68,0.12);
            --info:#06b6d4;--info-soft:rgba(6,182,212,0.12);
          }
          *,*::before,*::after{box-sizing:border-box;}
          body,html{background:var(--bg);color:var(--text);margin:0;padding:0;}
          *{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
          input,select,textarea{background:var(--surface-2)!important;color:var(--text)!important;border-color:var(--border-2)!important;}
          @keyframes spin{to{transform:rotate(360deg);}}
          table tr:last-child td{border-bottom:none!important;}
        `}</style>
        <AdminPanel />
      </main>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AdminShell() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (p?.role === 'platform_admin') {
          setUser(session.user)
          setProfile(p)
        } else {
          await supabase.auth.signOut()
        }
      }
      setLoading(false)
    })
  }, [])

  const handleLogin = async (email, password) => {
    setLoginLoading(true)
    setLoginError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setLoginError(error.message); setLoginLoading(false); return }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    if (p?.role !== 'platform_admin') {
      await supabase.auth.signOut()
      setLoginError('Geen admin-toegang. Alleen platform admins kunnen hier inloggen.')
      setLoginLoading(false)
      return
    }
    setUser(data.user)
    setProfile(p)
    setLoginLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Shield size={20} color="#fff" />
          </div>
          <div style={{ color: s.text3, fontSize: 13 }}>Laden…</div>
        </div>
      </div>
    )
  }

  if (!user) return <AdminLoginPage onLogin={handleLogin} onDirectAccess={() => { setUser({ id: 'local' }); setProfile({ full_name: 'Admin (tijdelijk)' }) }} loading={loginLoading} error={loginError} />
  return <AdminDashboard profile={profile} onLogout={handleLogout} />
}
