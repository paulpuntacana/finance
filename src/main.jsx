import { StrictMode, useEffect, lazy, Suspense } from 'react'
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

const Loader = () => (
  <div style={{ minHeight: '100vh', background: 'var(--bg, #060b15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: '36px', height: '36px', background: 'var(--accent, #3b82f6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: '700', color: '#fff', fontSize: '18px' }}>D</div>
      <div style={{ color: 'var(--text-3, #3d5c80)', fontSize: '13px' }}>Laden…</div>
    </div>
  </div>
)

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
    const { user, profile, loading, isConfigured } = useAuth()
    const signToken = getSignToken()

    useEffect(() => {
      const saved = localStorage.getItem('dhs_theme') || 'dark'
      document.documentElement.setAttribute('data-theme', saved)
    }, [])

    if (loading) return <Loader />
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
