import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { UserPlus, X, AlertCircle, RefreshCw, Users, Mail } from 'lucide-react'
import { Button, Card, Input, Select, Modal, PageHeader, EmptyState } from './ui'
import { inviteUser } from './manageUsers'

const ROLE_LABELS = {
  accountant: { label: 'Accountant', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  employee:   { label: 'Medewerker', color: 'var(--success)', bg: 'var(--success-soft)' },
  org_owner:  { label: 'Eigenaar',   color: 'var(--warning)', bg: 'var(--warning-soft)' },
}

const ErrorBox = ({ children }) => (
  <div role="alert" className="flex items-center gap-2 rounded-[8px] px-3 py-2.5 mb-4 text-[12.5px]" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
    <AlertCircle size={14} className="shrink-0" /> <span>{children}</span>
  </div>
)

// ── Modal: nodig medewerker of accountant uit ─────────────────────────────────
function AddUserModal({ orgId, onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'employee', access_type: 'bewerk' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.full_name.trim()) {
      setError('Vul naam en e-mailadres in.')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await inviteUser({
      email: form.email,
      fullName: form.full_name,
      organizationId: orgId,
      role: form.role,
      accessType: form.role === 'accountant' ? form.access_type : 'meekijk',
    })
    setLoading(false)
    if (err) { setError(err); return }
    setSentTo(form.email.trim())
    onCreated()
  }

  return (
    <Modal open onClose={onClose} size="sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
              <UserPlus size={17} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold m-0">Teamlid uitnodigen</h2>
              <p className="text-[12px] m-0" style={{ color: 'var(--text-3)' }}>Medewerker of accountant voor je organisatie</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Sluiten"><X size={16} /></Button>
        </div>

        {sentTo ? (
          <div>
            <div className="flex items-start gap-2 rounded-[8px] px-3 py-2.5 mb-4 text-[13px]" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <Mail size={15} className="shrink-0 mt-0.5" />
              <span>Uitnodiging verstuurd naar <strong>{sentTo}</strong>. Via de link in de mail kiest deze persoon zelf een wachtwoord.</span>
            </div>
            <Button className="w-full" onClick={onClose}>Klaar</Button>
          </div>
        ) : (
          <>
            {error && <ErrorBox>{error}</ErrorBox>}
            <form onSubmit={handleCreate} className="flex flex-col gap-3.5">
              <Input label="Volledige naam" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jan de Vries" required />
              <Input label="E-mailadres" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jan@bedrijf.nl" required />
              <Select label="Rol" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="employee">Medewerker — eigen declaraties en uren</option>
                <option value="accountant">Accountant — boekhouding en rapportages</option>
              </Select>
              {form.role === 'accountant' && (
                <Select label="Toegang" value={form.access_type} onChange={e => setForm(f => ({ ...f, access_type: e.target.value }))}>
                  <option value="bewerk">Bewerken — kan boekingen aanpassen</option>
                  <option value="meekijk">Meekijken — alleen lezen</option>
                </Select>
              )}
              <p className="text-[12px] m-0" style={{ color: 'var(--text-3)' }}>
                De persoon krijgt een e-mail met een link om een wachtwoord in te stellen.
              </p>
              <div className="flex gap-2.5 mt-1">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Versturen…' : 'Uitnodiging versturen'}
                </Button>
                <Button type="button" variant="secondary" onClick={onClose}>Annuleren</Button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── Hoofdcomponent ───────────────────────────────────────────────────────────
export default function OrgUsersView({ profile }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const orgId = profile?.organization_id

  const load = async () => {
    if (!isSupabaseConfigured || !orgId) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
    if (err) setError(`Teamleden laden mislukt: ${err.message}`)
    else setError('')
    setMembers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleActive = async (member) => {
    setError('')
    const next = !(member.is_active ?? true)
    const { data, error: err } = await supabase.from('profiles').update({ is_active: next }).eq('id', member.id).select('id')
    if (err) { setError(`Wijzigen mislukt: ${err.message}`); return }
    if (!data?.length) { setError('Wijzigen mislukt: je hebt geen rechten om dit teamlid te beheren.'); return }
    setMembers(ms => ms.map(m => m.id === member.id ? { ...m, is_active: next } : m))
  }

  if (!orgId) {
    return (
      <Card>
        <EmptyState icon={Users} title="Geen organisatie" description="Er is geen organisatie gekoppeld aan je account." />
      </Card>
    )
  }

  const canManage = profile?.role === 'org_owner' || profile?.role === 'platform_admin'

  return (
    <div className="space-y-5" style={{ maxWidth: 900 }}>
      {showCreate && (
        <AddUserModal orgId={orgId} onClose={() => setShowCreate(false)} onCreated={load} />
      )}

      <PageHeader
        title="Teambeheer"
        sub="Medewerkers en accountants van je organisatie"
        actions={<>
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Vernieuwen
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <UserPlus size={14} /> Teamlid uitnodigen
            </Button>
          )}
        </>}
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card className="overflow-hidden">
        {!isSupabaseConfigured ? (
          <div className="p-10 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>
            Supabase niet geconfigureerd — gebruikersbeheer is niet beschikbaar.
          </div>
        ) : members.length === 0 ? (
          loading
            ? <div className="p-10 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>Laden…</div>
            : <EmptyState icon={Users} title="Nog geen teamleden" description='Klik op "Teamlid uitnodigen" om te beginnen.' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Gebruiker', 'Rol', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-[12px] font-medium" style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => {
                  const roleInfo = ROLE_LABELS[m.role] || { label: m.role, color: 'var(--text-3)', bg: 'var(--surface-3)' }
                  const active = m.is_active ?? true
                  const isOwner = m.role === 'org_owner' || m.role === 'platform_admin'
                  return (
                    <tr key={m.id} style={{ opacity: active ? 1 : 0.55 }}>
                      <td className="px-3 py-3 text-[13px]" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            {(m.full_name || m.email || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{m.full_name || '—'}</div>
                            <div className="text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full" style={{ background: roleInfo.bg, color: roleInfo.color }}>
                          {roleInfo.label}{m.access_type === 'meekijk' && m.role === 'accountant' ? ' · meekijken' : ''}
                        </span>
                      </td>
                      <td className="px-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <span className="text-[11.5px] font-medium px-2 py-0.5 rounded-full" style={{ background: active ? 'var(--success-soft)' : 'var(--surface-2)', color: active ? 'var(--success)' : 'var(--text-3)' }}>
                          {active ? 'Actief' : 'Inactief'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right" style={{ borderBottom: '1px solid var(--border)' }}>
                        {canManage && !isOwner && (
                          <Button variant="secondary" size="sm" onClick={() => toggleActive(m)}>
                            {active ? 'Deactiveren' : 'Activeren'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
