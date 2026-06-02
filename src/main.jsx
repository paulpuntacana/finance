import { StrictMode, useState, useEffect, useRef, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider, useAuth } from './AuthProvider'

// Lazy load — browser only downloads what's actually needed
const LoginPage = lazy(() => import('./LoginPage'))
const EmployeePortal = lazy(() => import('./EmployeePortal'))
const AccountantPortal = lazy(() => import('./AccountantPortal'))
const AdminShell = lazy(() => import('./AdminShell'))
const App = lazy(() => import('../factuur-app.jsx'))
const PublicSignPage = lazy(() => import('./PublicSignPage'))
const SetupWizard = lazy(() => import('./SetupWizard'))

const getSignToken = () => new URLSearchParams(window.location.search).get('sign') || null

const BOOT_LINES = [
  { delay: 80,   text: '> Booting DHS Finance...',              dim: true },
  { delay: 420,  text: '> Connecting to Supabase...',           dim: true },
  { delay: 780,  text: '> Authenticating session...',           dim: true },
  { delay: 1140, text: '> Loading organisation profile...',     dim: true },
  { delay: 1500, text: '> Syncing ledger & invoices...',        dim: true },
  { delay: 1860, text: '$ All systems operational.',            dim: false },
]

const Loader = () => {
  const [lines, setLines] = useState([])

  useEffect(() => {
    const timers = BOOT_LINES.map(({ delay, text, dim }) =>
      setTimeout(() => setLines(prev => [...prev, { text, dim }]), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <>
      <style>{`
        @keyframes dhsBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes dhsFade { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{
        minHeight: '100vh', background: '#060b15',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '18px',
      }}>
        {/* Terminal window */}
        <div style={{
          width: 360, background: '#0d1117',
          border: '1px solid #1e3a5f', borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 0 48px rgba(79,70,229,0.12), 0 20px 60px rgba(0,0,0,0.7)',
          animation: 'dhsFade 0.4s ease 0.1s both',
        }}>
          {/* Chrome bar */}
          <div style={{
            background: '#161b22', padding: '9px 14px',
            display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: '1px solid #1e2a3f',
          }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
            <span style={{ color: '#3d5c80', fontSize: 10, marginLeft: 8, fontFamily: '"SF Mono","Fira Code",monospace' }}>dhs-finance — init</span>
          </div>

          {/* Output lines */}
          <div style={{ padding: '14px 16px', minHeight: 128 }}>
            {lines.map((line, i) => (
              <div key={i} style={{
                fontFamily: '"SF Mono","Fira Code",ui-monospace,monospace',
                fontSize: 11.5, lineHeight: 1.85,
                color: line.dim ? '#4a6580' : '#4ade80',
                animation: 'dhsFade 0.25s ease',
              }}>
                {line.text}
              </div>
            ))}
            {lines.length < BOOT_LINES.length && (
              <span style={{
                display: 'inline-block', width: 7, height: 13,
                background: '#4ade80', verticalAlign: 'text-bottom', marginTop: 2,
                animation: 'dhsBlink 1s step-end infinite',
              }} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// Route /admin to standalone admin shell
if (window.location.pathname === '/admin') {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Suspense fallback={<Loader />}>
        <AdminShell />
      </Suspense>
    </StrictMode>
  )
} else if (getSignToken()) {
  // Sign links open a standalone page — no login, no dashboard
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Suspense fallback={<Loader />}>
        <PublicSignPage signToken={getSignToken()} />
      </Suspense>
    </StrictMode>
  )
} else {
  function AppShell() {
    const { user, profile, loading, profileLoading, isConfigured } = useAuth()
    const signToken = getSignToken()
    const hasBootedRef = useRef(false)

    useEffect(() => {
      const saved = localStorage.getItem('dhs_theme') || 'dark'
      document.documentElement.setAttribute('data-theme', saved)
    }, [])

    // Toon loader alleen bij het eerste opstarten, niet bij latere profiel-herladen
    // (bijv. door Supabase token-refresh bij tab-wissel). Zo blijft <App /> gemonteerd
    // en verlies je je actieve tab/venster niet.
    if (!hasBootedRef.current && (loading || profileLoading)) return <Loader />

    hasBootedRef.current = true

    if (!isConfigured) return <App signToken={signToken} />
    if (!user && !signToken) return <LoginPage />
    if (user && profile?.role === 'employee') return <EmployeePortal />
    if (user && profile?.role === 'accountant') return <AccountantPortal />
    if (user && !user.isLocal && profile && !profile.organization_id) return <SetupWizard />
    return <App signToken={signToken} />
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <AuthProvider>
        <Suspense fallback={<Loader />}>
          <AppShell />
        </Suspense>
      </AuthProvider>
    </StrictMode>,
  )
}
