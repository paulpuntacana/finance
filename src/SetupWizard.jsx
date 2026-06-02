import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { Building2, Loader2, ArrowRight, LogOut } from 'lucide-react'

export default function SetupWizard() {
  const { createOrg, signOut, user, profile } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [tab, setTab] = useState('create')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!orgName.trim()) { setError('Bedrijfsnaam is verplicht'); return }
    setError('')
    setLoading(true)
    const { error } = await createOrg(orgName.trim())
    setLoading(false)
    if (error) setError(error.message)
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!inviteCode.trim()) { setError('Uitnodigingscode is verplicht'); return }
    setError('')
    setLoading(true)
    const { supabase } = await import('./supabase')
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single()
    if (!org) { setLoading(false); setError('Onbekende uitnodigingscode'); return }
    const { error } = await supabase
      .from('profiles')
      .update({ organization_id: org.id, role: 'employee' })
      .eq('id', user.id)
    setLoading(false)
    if (error) setError(error.message)
    else window.location.reload()
  }

  const inp = { width: '100%', padding: '11px 14px', fontSize: '14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', background: '#fff', color: '#1E293B', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  const btn = { background: '#3B82F6', border: 'none', borderRadius: '10px', padding: '12px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit', width: '100%', boxShadow: '0 2px 10px rgba(59,130,246,0.28)' }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: '24px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }}>
          <div style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: '800', fontSize: '12px', color: '#fff' }}>DH</span>
          </div>
          <span style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>DHS Finance</span>
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '48px', height: '48px', background: '#EFF6FF', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <Building2 size={22} style={{ color: '#3B82F6' }} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Organisatie instellen</h1>
          <p style={{ color: '#64748B', fontSize: '14px', margin: '0 0 24px', lineHeight: 1.6 }}>
            Welkom{profile?.full_name ? `, ${profile.full_name}` : ''}! Maak een organisatie aan of sluit je aan bij een bestaande via een uitnodigingscode.
          </p>

          <div style={{ display: 'flex', gap: '2px', background: '#F8FAFC', borderRadius: '10px', padding: '3px', marginBottom: '24px', border: '1px solid #F1F5F9' }}>
            {[['create', 'Nieuwe organisatie'], ['join', 'Aansluiten']].map(([t, label]) => (
              <button key={t} onClick={() => { setTab(t); setError('') }}
                style={{ flex: 1, padding: '7px 0', borderRadius: '7px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#1E293B' : '#94A3B8', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.07)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', color: '#DC2626', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {tab === 'create' && (
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '7px' }}>Bedrijfsnaam</label>
                <input type="text" required value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Future Marketing B.V." style={inp} />
              </div>
              <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
                {loading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Aanmaken…</> : <>Organisatie aanmaken <ArrowRight size={15} /></>}
              </button>
            </form>
          )}

          {tab === 'join' && (
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '7px' }}>Uitnodigingscode</label>
                <input type="text" required value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="DHS2026" style={{ ...inp, letterSpacing: '0.05em', fontWeight: '600' }} />
              </div>
              <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
                {loading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Aansluiten…</> : <>Aansluiten <ArrowRight size={15} /></>}
              </button>
            </form>
          )}
        </div>

        <button onClick={signOut} style={{ marginTop: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
          <LogOut size={13} /> Uitloggen
        </button>
      </div>
    </div>
  )
}
