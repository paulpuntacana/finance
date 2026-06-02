import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { Building2, ArrowRight, AlertCircle } from 'lucide-react'

export default function SetupWizard() {
  const { user, profile, createOrg, signOut } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Bedrijfsnaam is verplicht'); return }
    setLoading(true); setError('')
    const { error: err } = await createOrg(name)
    if (err) { setError(err.message); setLoading(false); return }
    window.location.href = '/'
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#060b15', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
          }}>
            <Building2 size={24} color="#fff" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#dce8ff', letterSpacing: '-0.02em' }}>
            Welkom bij DHS Finance
          </div>
          <div style={{ fontSize: 13, color: '#3d5c80', marginTop: 6 }}>
            Maak je organisatie aan om te beginnen
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#0e1628', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 16, padding: '32px 28px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 12, color: '#3d5c80', marginBottom: 22 }}>
            Ingelogd als{' '}
            <strong style={{ color: '#7a9cc8' }}>{profile?.full_name || user?.email}</strong>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444',
              borderRadius: 8, padding: '10px 12px', color: '#ef4444', fontSize: 12,
              marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: '#7a9cc8', marginBottom: 6,
              }}>
                Bedrijfsnaam
              </label>
              <input
                style={{
                  background: '#131e32', border: '1px solid rgba(59,130,246,0.25)',
                  borderRadius: 8, color: '#dce8ff', padding: '11px 13px',
                  fontSize: 14, width: '100%', outline: 'none', boxSizing: 'border-box',
                }}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jouw Bedrijf BV"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#3b82f6', border: 'none', borderRadius: 9,
                padding: '12px', color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Aanmaken…' : <><span>Organisatie aanmaken</span><ArrowRight size={15} /></>}
            </button>
          </form>

          <div style={{
            marginTop: 20, paddingTop: 16,
            borderTop: '1px solid rgba(59,130,246,0.1)',
            textAlign: 'center', fontSize: 11, color: '#3d5c80',
          }}>
            Verkeerd account?{' '}
            <button
              onClick={signOut}
              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 11, padding: 0 }}
            >
              Uitloggen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
