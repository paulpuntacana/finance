import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { Eye, EyeOff, Loader2, ArrowRight, Check, Shield, TrendingUp, BarChart3 } from 'lucide-react'

const QUICK_LOGIN_KEY = 'dhs_quick_login'
const QUICK_USER = {
  email: 'paul@denhartoghsolutions.nl',
  name: 'Paul den Hartogh',
  role: 'platform_admin',
  company: 'Den Hartogh Solutions'
}

function FinanceIllustration() {
  return (
    <svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: '460px' }}>
      {/* Soft background blobs */}
      <circle cx="390" cy="70" r="110" fill="#DBEAFE" opacity="0.55" />
      <circle cx="110" cy="340" r="90" fill="#EDE9FE" opacity="0.4" />

      {/* ── TABLE ── */}
      <rect x="50" y="275" width="400" height="14" rx="7" fill="#CBD5E1" />
      <rect x="72" y="288" width="18" height="56" rx="4" fill="#94A3B8" />
      <rect x="410" y="288" width="18" height="56" rx="4" fill="#94A3B8" />

      {/* ── LAPTOP BASE ── */}
      <rect x="155" y="236" width="190" height="42" rx="7" fill="#334155" />
      <rect x="159" y="239" width="182" height="35" rx="5" fill="#1E293B" />
      <rect x="216" y="262" width="68" height="11" rx="3" fill="#263245" />
      <rect x="155" y="230" width="190" height="8" rx="4" fill="#2D3A4E" />

      {/* ── LAPTOP SCREEN ── */}
      <rect x="138" y="95" width="224" height="140" rx="11" fill="#1E293B" />
      <rect x="145" y="102" width="210" height="126" rx="7" fill="#EFF6FF" />

      {/* Screen header bar */}
      <rect x="145" y="102" width="210" height="22" rx="7" fill="#DBEAFE" />
      <rect x="145" y="116" width="210" height="8" fill="#DBEAFE" />
      <circle cx="157" cy="113" r="4" fill="#93C5FD" />
      <circle cx="169" cy="113" r="4" fill="#BAE6FD" />
      <circle cx="181" cy="113" r="4" fill="#A5F3FC" />
      <rect x="200" y="109" width="80" height="8" rx="4" fill="#BFDBFE" opacity="0.7" />

      {/* Screen chart bars */}
      <rect x="158" y="208" width="12" height="14" rx="2" fill="#BFDBFE" />
      <rect x="174" y="197" width="12" height="25" rx="2" fill="#93C5FD" />
      <rect x="190" y="186" width="12" height="36" rx="2" fill="#60A5FA" />
      <rect x="206" y="179" width="12" height="43" rx="2" fill="#3B82F6" />
      <rect x="222" y="192" width="12" height="30" rx="2" fill="#60A5FA" />
      <rect x="238" y="172" width="12" height="50" rx="2" fill="#2563EB" />
      <rect x="254" y="180" width="12" height="42" rx="2" fill="#60A5FA" />
      <rect x="270" y="188" width="12" height="34" rx="2" fill="#93C5FD" />
      <rect x="286" y="195" width="12" height="27" rx="2" fill="#BFDBFE" />
      <rect x="302" y="183" width="12" height="39" rx="2" fill="#60A5FA" />
      <rect x="318" y="170" width="12" height="52" rx="2" fill="#3B82F6" />

      {/* Screen amount label */}
      <rect x="158" y="134" width="55" height="8" rx="3" fill="#3B82F6" opacity="0.25" />
      <rect x="158" y="147" width="85" height="14" rx="4" fill="#1E40AF" opacity="0.18" />
      <rect x="158" y="166" width="40" height="6" rx="2" fill="#BBF7D0" opacity="0.7" />

      {/* ── CHAIR BACK ── */}
      <rect x="208" y="188" width="84" height="90" rx="16" fill="#E2E8F0" />
      <rect x="216" y="196" width="68" height="75" rx="12" fill="#CBD5E1" />

      {/* ── PERSON BODY ── */}
      <rect x="205" y="196" width="90" height="60" rx="20" fill="#4F46E5" />

      {/* Collar */}
      <path d="M244 196 L250 210 L256 196" fill="white" opacity="0.3" />

      {/* ── ARM pointing at screen ── */}
      <rect x="280" y="210" width="54" height="18" rx="9" fill="#FDBA74" />
      <circle cx="337" cy="219" r="9" fill="#FDBA74" />

      {/* ── ARM left ── */}
      <rect x="166" y="208" width="42" height="17" rx="8.5" fill="#4F46E5" />
      <circle cx="162" cy="215" r="9" fill="#FDBA74" />

      {/* ── NECK ── */}
      <rect x="236" y="176" width="28" height="24" rx="9" fill="#FDBA74" />

      {/* ── HEAD ── */}
      <circle cx="250" cy="154" r="30" fill="#FDBA74" />

      {/* Hair */}
      <path d="M222 142 Q228 116 272 118 Q292 125 282 144 Q266 132 234 135 Z" fill="#1E293B" />
      {/* Hair side */}
      <path d="M222 142 Q218 155 222 165 Q225 155 228 148 Z" fill="#1E293B" />
      <path d="M278 142 Q282 152 280 162 Q276 153 272 147 Z" fill="#1E293B" />

      {/* Eyes */}
      <ellipse cx="241" cy="154" rx="4" ry="4.5" fill="white" />
      <ellipse cx="259" cy="154" rx="4" ry="4.5" fill="white" />
      <circle cx="242" cy="155" r="2.5" fill="#1E293B" />
      <circle cx="260" cy="155" r="2.5" fill="#1E293B" />
      <circle cx="243" cy="154" r="1" fill="white" />
      <circle cx="261" cy="154" r="1" fill="white" />

      {/* Eyebrows */}
      <path d="M237 148 Q241 145 246 147" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M255 147 Q259 145 263 148" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Smile */}
      <path d="M243 165 Q250 172 257 165" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* ── FLOATING CARD: Invoice ── */}
      <g transform="translate(360, 100) rotate(-6)">
        <rect width="118" height="88" rx="12" fill="white" style={{ filter: 'drop-shadow(0 6px 18px rgba(59,130,246,0.14))' }} />
        <rect x="12" y="14" width="56" height="7" rx="3" fill="#E2E8F0" />
        <rect x="12" y="26" width="38" height="5" rx="2" fill="#F1F5F9" />
        <rect x="12" y="44" width="94" height="1" fill="#F1F5F9" />
        <rect x="12" y="52" width="55" height="5" rx="2" fill="#BFDBFE" />
        <rect x="12" y="63" width="38" height="4" rx="2" fill="#F1F5F9" />
        <text x="59" y="82" fontSize="12" fontWeight="700" fill="#1E293B" textAnchor="middle">€ 2.840</text>
      </g>

      {/* ── FLOATING CARD: Growth badge ── */}
      <g transform="translate(22, 118)">
        <rect width="108" height="54" rx="14" fill="white" style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.08))' }} />
        <circle cx="27" cy="27" r="15" fill="#DCFCE7" />
        <path d="M20 31 L25 25 L29 28 L35 21" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="68" y="23" fontSize="13" fontWeight="700" fill="#16A34A" textAnchor="middle">+18.4%</text>
        <text x="68" y="37" fontSize="10" fill="#94A3B8" textAnchor="middle">Omzet YTD</text>
      </g>

      {/* ── FLOATING CARD: Factuur verzonden ── */}
      <g transform="translate(20, 196)">
        <rect width="106" height="50" rx="12" fill="white" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.07))' }} />
        <rect x="10" y="10" width="30" height="30" rx="8" fill="#EFF6FF" />
        <rect x="15" y="16" width="20" height="4" rx="2" fill="#93C5FD" />
        <rect x="15" y="23" width="14" height="3" rx="1.5" fill="#BFDBFE" />
        <rect x="15" y="30" width="18" height="3" rx="1.5" fill="#DBEAFE" />
        <text x="70" y="27" fontSize="10" fontWeight="600" fill="#1E293B" textAnchor="middle">Factuur</text>
        <text x="70" y="40" fontSize="9.5" fill="#3B82F6" textAnchor="middle">verzonden ✓</text>
      </g>

      {/* ── FLOATING CARD: BTW ── */}
      <g transform="translate(374, 215)">
        <rect width="102" height="50" rx="12" fill="white" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.07))' }} />
        <circle cx="25" cy="25" r="14" fill="#FEF3C7" />
        <path d="M25 17 L25 25 L30 29" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x="64" y="22" fontSize="10" fontWeight="600" fill="#1E293B" textAnchor="middle">BTW</text>
        <text x="64" y="35" fontSize="9" fill="#D97706" textAnchor="middle">aangifte klaar</text>
      </g>

      {/* Decorative dots */}
      <circle cx="455" cy="355" r="5" fill="#BFDBFE" opacity="0.7" />
      <circle cx="440" cy="368" r="3" fill="#C7D2FE" opacity="0.5" />
      <circle cx="466" cy="370" r="2" fill="#BFDBFE" opacity="0.4" />
      <circle cx="45" cy="360" r="4" fill="#DDD6FE" opacity="0.5" />
      <circle cx="56" cy="373" r="2.5" fill="#DDD6FE" opacity="0.4" />
    </svg>
  )
}

export default function LoginPage() {
  const { signIn, signUp, quickLogin, isConfigured } = useAuth()
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [quickLoading, setQuickLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error.message)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Naam is verplicht'); return }
    if (password.length < 8) { setError('Wachtwoord minimaal 8 tekens'); return }
    setLoading(true)
    const { error } = await signUp(email, password, fullName, inviteCode)
    setLoading(false)
    if (error) setError(error.message)
    else setSuccess('Check je e-mail voor de bevestigingslink!')
  }

  const handleQuickLogin = () => {
    setQuickLoading(true)
    quickLogin(QUICK_USER)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter', -apple-system, sans-serif", background: '#ffffff' }}>
      <style>{`


        .lp-inp {
          background: #ffffff !important;
          border: 1.5px solid #E2E8F0 !important;
          border-radius: 10px;
          color: #1E293B !important;
          padding: 11px 14px;
          width: 100%;
          font-size: 14px;
          outline: none;
          transition: border-color 0.16s, box-shadow 0.16s;
          box-sizing: border-box;
          font-family: 'Inter', sans-serif;
        }
        .lp-inp:focus {
          border-color: #3B82F6 !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.10) !important;
        }
        .lp-inp::placeholder { color: #94A3B8 !important; }

        .lp-btn-primary {
          background: #3B82F6;
          border: none;
          border-radius: 10px;
          padding: 12px 20px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 2px 10px rgba(59,130,246,0.28);
        }
        .lp-btn-primary:hover { background: #2563EB; box-shadow: 0 4px 16px rgba(59,130,246,0.35); }
        .lp-btn-primary:active { transform: scale(0.99); }
        .lp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }

        .lp-quick-btn {
          background: #F8FAFC;
          border: 1.5px solid #E2E8F0;
          border-radius: 12px;
          padding: 12px 16px;
          cursor: pointer;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          transition: background 0.14s, border-color 0.14s, box-shadow 0.14s;
          font-family: 'Inter', sans-serif;
        }
        .lp-quick-btn:hover {
          background: #EFF6FF;
          border-color: #BFDBFE;
          box-shadow: 0 2px 10px rgba(59,130,246,0.08);
        }

        .lp-tab-btn {
          flex: 1;
          padding: 8px 0;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.14s;
          font-family: 'Inter', sans-serif;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slide-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .lp-animate { animation: slide-in 0.3s ease-out; }

        @media (max-width: 860px) {
          .lp-right-panel { display: none !important; }
          .lp-left-panel { width: 100% !important; max-width: 100% !important; padding: 40px 28px !important; }
        }
      `}</style>

      {/* ── LEFT — Auth panel ────────────────────────────────────────────────── */}
      <div className="lp-left-panel" style={{
        width: '460px',
        minWidth: '400px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '52px 52px',
        boxSizing: 'border-box',
        background: '#ffffff',
        borderRight: '1px solid #F1F5F9',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Logo */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              borderRadius: '11px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59,130,246,0.30)',
              flexShrink: 0,
            }}>
              <span style={{ fontWeight: '800', fontSize: '13px', color: '#fff', letterSpacing: '-0.05em' }}>DH</span>
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '16px', color: '#0F172A', letterSpacing: '-0.025em' }}>DHS Finance</div>
              <div style={{ fontSize: '10px', color: '#94A3B8', letterSpacing: '0.08em', fontWeight: '500', textTransform: 'uppercase', marginTop: '1px' }}>Financial Platform</div>
            </div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#0F172A', margin: '0 0 7px', letterSpacing: '-0.03em', lineHeight: 1.25 }}>
            {tab === 'login' ? 'Welkom terug' : 'Account aanmaken'}
          </h1>
          <p style={{ color: '#64748B', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
            {tab === 'login' ? 'Log in op je financieel dashboard.' : 'Start met inzicht in je business.'}
          </p>
        </div>

        {/* Quick login */}
        <div style={{ marginBottom: '22px' }}>
          <button onClick={handleQuickLogin} disabled={quickLoading} className="lp-quick-btn">
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: '0 2px 8px rgba(59,130,246,0.25)',
              }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#fff', letterSpacing: '-0.05em' }}>DH</span>
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0F172A', textAlign: 'left' }}>
                  {quickLoading ? 'Inloggen…' : 'Den Hartogh Solutions'}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'left', marginTop: '1px' }}>Platform Admin · Snel inloggen</div>
              </div>
            </div>
            {quickLoading
              ? <Loader2 size={15} style={{ color: '#3B82F6', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              : <ArrowRight size={15} style={{ color: '#CBD5E1', flexShrink: 0 }} />
            }
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: '#F1F5F9' }} />
          <span style={{ fontSize: '11px', color: '#CBD5E1', fontWeight: '500', letterSpacing: '0.04em' }}>of gebruik e-mail</span>
          <div style={{ flex: 1, height: '1px', background: '#F1F5F9' }} />
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '3px', background: '#F8FAFC', borderRadius: '11px', padding: '3px', marginBottom: '20px', border: '1px solid #F1F5F9' }}>
          {[['login', 'Inloggen'], ['register', 'Registreren']].map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
              className="lp-tab-btn"
              style={{
                background: tab === t ? '#ffffff' : 'transparent',
                color: tab === t ? '#1E293B' : '#94A3B8',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Messages */}
        {success && (
          <div className="lp-animate" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', color: '#15803D', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={14} /> {success}
          </div>
        )}
        {error && (
          <div className="lp-animate" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', color: '#DC2626', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Login form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: '600', marginBottom: '7px' }}>E-mailadres</label>
              <input className="lp-inp" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="paul@bedrijf.nl" />
            </div>
            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: '600', marginBottom: '7px' }}>Wachtwoord</label>
              <div style={{ position: 'relative' }}>
                <input className="lp-inp" type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••" style={{ paddingRight: '42px' }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="lp-btn-primary" style={{ marginTop: '4px' }}>
              {loading
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Inloggen…</>
                : <>Inloggen <ArrowRight size={15} /></>
              }
            </button>
          </form>
        )}

        {/* Register form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: '600', marginBottom: '7px' }}>Volledige naam</label>
              <input className="lp-inp" type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jan de Vries" />
            </div>
            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: '600', marginBottom: '7px' }}>E-mailadres</label>
              <input className="lp-inp" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="jan@bedrijf.nl" />
            </div>
            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: '600', marginBottom: '7px' }}>Wachtwoord</label>
              <div style={{ position: 'relative' }}>
                <input className="lp-inp" type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimaal 8 tekens" style={{ paddingRight: '42px' }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '12px', fontWeight: '600', marginBottom: '7px' }}>
                Uitnodigingscode <span style={{ color: '#CBD5E1', fontWeight: '400' }}>— optioneel</span>
              </label>
              <input className="lp-inp" type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="ABC123" />
            </div>
            <button type="submit" disabled={loading} className="lp-btn-primary" style={{ marginTop: '4px' }}>
              {loading
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Laden…</>
                : <>Account aanmaken <ArrowRight size={15} /></>
              }
            </button>
          </form>
        )}

        {!isConfigured && (
          <div style={{ marginTop: '16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '10px 14px', color: '#92400E', fontSize: '12px' }}>
            Supabase niet geconfigureerd — gebruik de snelle inlog hierboven.
          </div>
        )}

        {/* Feature highlights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '28px' }}>
          {[
            { icon: BarChart3, label: 'Facturen & BTW', desc: 'Maak, verstuur en volg facturen op', color: '#3B82F6', bg: '#EFF6FF' },
            { icon: TrendingUp, label: 'HorizonPlanner', desc: 'Plan je financiële toekomst visueel', color: '#7C3AED', bg: '#F5F3FF' },
            { icon: Shield, label: 'SSL-beveiligd', desc: 'Jouw data veilig en NL-wetgeving compliant', color: '#16A34A', bg: '#F0FDF4' },
          ].map(({ icon: Icon, label, desc, color, bg }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '10px 14px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={15} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B', lineHeight: 1.2 }}>{label}</div>
                <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '32px', color: '#CBD5E1', fontSize: '11px' }}>
          © {new Date().getFullYear()} DHS Finance · Den Hartogh Solutions
        </div>
      </div>

      {/* ── RIGHT — Visual panel ─────────────────────────────────────────────── */}
      <div className="lp-right-panel" style={{
        flex: 1,
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 56px',
        background: 'linear-gradient(145deg, #EFF6FF 0%, #F0F4FF 40%, #F5F3FF 80%, #EEF2FF 100%)',
      }}>

        {/* Subtle dot grid */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.25) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

        {/* Content */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '520px', textAlign: 'center' }}>

          {/* Headline */}
          <div style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '700', color: '#0F172A', lineHeight: 1.25, letterSpacing: '-0.03em', margin: '0 0 14px' }}>
              Alles op orde.<br />
              <span style={{ color: '#3B82F6' }}>Overal en altijd.</span>
            </h2>
            <p style={{ color: '#64748B', fontSize: '15px', margin: 0, lineHeight: 1.65, maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
              Facturen, bonnen, BTW en jaarplanning in één helder overzicht voor jou en je boekhouder.
            </p>
          </div>

          {/* Illustration */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '36px' }}>
            <FinanceIllustration />
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              {
                label: 'Omzet YTD', value: '€ 147k', delta: '+18.4%',
                accent: '#16A34A', accentBg: '#F0FDF4', accentBorder: '#BBF7D0',
                bars: [40, 55, 48, 62, 58, 70, 65, 80, 72, 95],
                barColor: '#86EFAC', barActive: '#16A34A',
              },
              {
                label: 'Liquiditeit', value: '+4 mnd', delta: 'Gezond',
                accent: '#2563EB', accentBg: '#EFF6FF', accentBorder: '#BFDBFE',
                bars: [60, 62, 65, 64, 68, 70, 72, 74, 76, 78],
                barColor: '#BFDBFE', barActive: '#3B82F6',
              },
              {
                label: 'Openstaand', value: '€ 8.4k', delta: '3 facturen',
                accent: '#D97706', accentBg: '#FFFBEB', accentBorder: '#FDE68A',
                bars: [80, 75, 82, 70, 68, 72, 65, 60, 55, 50],
                barColor: '#FDE68A', barActive: '#D97706',
              },
            ].map((m) => (
              <div key={m.label} style={{ background: '#ffffff', border: '1px solid #F1F5F9', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', textAlign: 'left', overflow: 'hidden', position: 'relative' }}>
                {/* Top accent strip */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: m.accent, borderRadius: '16px 16px 0 0' }} />
                <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px', marginTop: '4px' }}>{m.label}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.03em', marginBottom: '8px', lineHeight: 1 }}>{m.value}</div>
                {/* Mini sparkline */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '24px', marginBottom: '8px' }}>
                  {m.bars.map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: i === m.bars.length - 1 ? m.barActive : m.barColor, borderRadius: '2px', minHeight: '3px' }} />
                  ))}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', background: m.accentBg, border: `1px solid ${m.accentBorder}`, borderRadius: '20px', padding: '3px 9px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '700', color: m.accent }}>{m.delta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
