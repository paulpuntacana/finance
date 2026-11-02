import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { Building2, Loader2, ArrowRight, LogOut } from 'lucide-react'
import { Button, Card, Input, Segmented } from './ui'

// Bekende serverfouten → duidelijke Nederlandse tekst
const friendlyError = (msg = '') => {
  if (/al lid van een organisatie/i.test(msg)) return 'Je bent al lid van een organisatie. Log opnieuw in om verder te gaan.'
  if (/onbekende uitnodigingscode/i.test(msg)) return 'Deze uitnodigingscode is onbekend. Controleer de code of vraag een nieuwe aan.'
  if (/ongeldige bedrijfsnaam/i.test(msg)) return 'Vul een geldige bedrijfsnaam in (maximaal 200 tekens).'
  if (/niet ingelogd/i.test(msg)) return 'Je sessie is verlopen. Log opnieuw in.'
  if (/failed to fetch|network/i.test(msg)) return 'Geen verbinding met de server. Probeer het opnieuw.'
  return msg || 'Er ging iets mis. Probeer het opnieuw.'
}

export default function SetupWizard() {
  const { createOrg, joinOrgByInvite, signOut, profile } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [tab, setTab] = useState('create')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!orgName.trim()) { setError('Bedrijfsnaam is verplicht.'); return }
    setError('')
    setLoading(true)
    const { error } = await createOrg(orgName.trim())
    setLoading(false)
    if (error) setError(friendlyError(error.message))
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!inviteCode.trim()) { setError('Uitnodigingscode is verplicht.'); return }
    setError('')
    setLoading(true)
    const { error } = await joinOrgByInvite(inviteCode.trim())
    setLoading(false)
    if (error) setError(friendlyError(error.message))
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <span className="text-[12px] font-extrabold text-white">DH</span>
          </div>
          <span className="text-[15px] font-semibold">DHS Finance</span>
        </div>

        <Card className="p-8" style={{ boxShadow: 'var(--shadow-1)' }}>
          <div className="w-12 h-12 rounded-[12px] flex items-center justify-center mb-5" style={{ background: 'var(--accent-soft)' }}>
            <Building2 size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-[22px] font-semibold mb-2" style={{ letterSpacing: '-0.02em' }}>Organisatie instellen</h1>
          <p className="text-[14px] mb-6" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
            Welkom{profile?.full_name ? `, ${profile.full_name}` : ''}! Maak een organisatie aan of sluit je aan bij een bestaande via een uitnodigingscode.
          </p>

          <div className="mb-6">
            <Segmented
              options={[{ id: 'create', label: 'Nieuwe organisatie' }, { id: 'join', label: 'Aansluiten' }]}
              value={tab}
              onChange={(t) => { setTab(t); setError('') }}
            />
          </div>

          {error && (
            <div role="alert" className="rounded-[10px] px-3.5 py-2.5 mb-4 text-[13px]" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          {tab === 'create' && (
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <Input label="Bedrijfsnaam" required maxLength={200} value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Future Marketing B.V." />
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Aanmaken…</> : <>Organisatie aanmaken <ArrowRight size={15} /></>}
              </Button>
            </form>
          )}

          {tab === 'join' && (
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <Input
                label="Uitnodigingscode"
                required
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Bijv. K7WQ-PX3M-RT"
                hint="Je krijgt na aansluiten alleen-lezen toegang. De eigenaar kan je rol daarna aanpassen."
              />
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Aansluiten…</> : <>Aansluiten <ArrowRight size={15} /></>}
              </Button>
            </form>
          )}
        </Card>

        <Button variant="ghost" size="sm" onClick={signOut} className="mt-4">
          <LogOut size={13} /> Uitloggen
        </Button>
      </div>
    </div>
  )
}
