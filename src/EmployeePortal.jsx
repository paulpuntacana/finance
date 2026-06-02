import { useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthProvider'
import { supabase, isSupabaseConfigured } from './supabase'
import { Upload, Camera, Plus, CheckCircle, Clock, XCircle, LogOut, Loader2, Receipt } from 'lucide-react'

const STATUS = {
  pending:  { label: 'In behandeling', color: 'var(--warning)', bg: 'var(--warning-soft)', icon: Clock },
  approved: { label: 'Goedgekeurd',    color: 'var(--success)', bg: 'var(--success-soft)',  icon: CheckCircle },
  rejected: { label: 'Afgewezen',      color: 'var(--danger)',  bg: 'var(--danger-soft)',    icon: XCircle },
}

const CATEGORIES = ['Reiskosten', 'Eten & Drinken', 'Kantoorartikelen', 'Software/SaaS', 'Hardware', 'Marketing', 'Overig']

export default function EmployeePortal() {
  const { user, profile, signOut } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ vendor: '', amount: '', currency: 'EUR', date: new Date().toISOString().split('T')[0], category: 'Overig', description: '', receipt_data: null })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef()

  const load = async () => {
    if (!isSupabaseConfigured || !user) { setLoading(false); return }
    const { data } = await supabase
      .from('expense_submissions')
      .select('*')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })
    setSubmissions(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user?.id])

  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setForm(f => ({ ...f, receipt_data: e.target.result }))
    reader.readAsDataURL(file)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.vendor || !form.amount) { setError('Leverancier en bedrag zijn verplicht'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('expense_submissions').insert({
      employee_id: user.id,
      organization_id: profile?.organization_id,
      vendor: form.vendor,
      amount: parseFloat(form.amount),
      currency: form.currency,
      date: form.date,
      category: form.category,
      description: form.description,
      receipt_data: form.receipt_data,
    })
    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setSuccess('Bon ingediend!')
      setForm({ vendor: '', amount: '', currency: 'EUR', date: new Date().toISOString().split('T')[0], category: 'Overig', description: '', receipt_data: null })
      setShowForm(false)
      load()
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const inp = {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: '8px', color: 'var(--text)', padding: '10px 12px',
    fontSize: '13px', width: '100%', outline: 'none',
  }

  const totalPending = submissions.filter(s => s.status === 'pending').reduce((a, s) => a + (s.amount || 0), 0)
  const totalApproved = submissions.filter(s => s.status === 'approved').reduce((a, s) => a + (s.amount || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '0' }}>
      <style>{`
        .ep-input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-soft); }
        .ep-input::placeholder { color: var(--text-3) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Top bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', color: '#fff' }}>D</div>
          <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text)' }}>DHS Finance</span>
          <span style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>Werknemer Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--text-3)', fontSize: '13px' }}>{profile?.full_name || user?.email}</span>
          <button onClick={signOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
            <LogOut size={14} /> Uitloggen
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              Bonnen indienen
            </h1>
            <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>Dien je bonnen in voor goedkeuring door je accountant</p>
          </div>
          <button onClick={() => { setShowForm(true); setError('') }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', border: 'none',
              borderRadius: '8px', padding: '9px 16px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            <Plus size={15} /> Nieuwe bon
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Ingediend', value: submissions.length, color: 'var(--accent)' },
            { label: 'In behandeling', value: `€ ${totalPending.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`, color: 'var(--warning)' },
            { label: 'Goedgekeurd', value: `€ ${totalApproved.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`, color: 'var(--success)' },
          ].map((st, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{st.label}</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: st.color, fontFamily: 'monospace' }}>{st.value}</div>
            </div>
          ))}
        </div>

        {success && (
          <div style={{ background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', color: 'var(--success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={15} /> {success}
          </div>
        )}

        {/* Submit form */}
        {showForm && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>Nieuwe bon indienen</h3>
            {error && <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '10px 14px', color: 'var(--danger)', fontSize: '12px', marginBottom: '16px' }}>{error}</div>}
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Leverancier *</label>
                  <input className="ep-input" style={inp} value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="bijv. Albert Heijn" required />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Bedrag *</label>
                  <input className="ep-input" style={inp} type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Datum</label>
                  <input className="ep-input" style={inp} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Categorie</label>
                  <select className="ep-input" style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Omschrijving</label>
                <input className="ep-input" style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optionele toelichting" />
              </div>

              {/* Receipt upload */}
              <div>
                <label style={{ display: 'block', color: 'var(--text-2)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Foto bon</label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
                {form.receipt_data ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={form.receipt_data} alt="bon" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <button type="button" onClick={() => setForm(f => ({ ...f, receipt_data: null }))}
                      style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', background: 'var(--danger)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: '#fff', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-2)', border: '1px dashed var(--border-2)', borderRadius: '8px', padding: '12px 16px', cursor: 'pointer', color: 'var(--text-3)', fontSize: '13px', width: '100%', justifyContent: 'center' }}>
                    <Camera size={15} /> Foto of afbeelding toevoegen
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button type="submit" disabled={saving}
                  style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Indienen...</> : 'Bon indienen'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', color: 'var(--text-2)', fontSize: '13px', cursor: 'pointer' }}>
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Submissions list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '40px' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', display: 'block', marginBottom: '8px' }} />
              Laden...
            </div>
          ) : submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <Receipt size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
              <p style={{ margin: 0 }}>Nog geen bonnen ingediend.</p>
            </div>
          ) : submissions.map(sub => {
            const st = STATUS[sub.status] || STATUS.pending
            const Icon = st.icon
            return (
              <div key={sub.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                {sub.receipt_data ? (
                  <img src={sub.receipt_data} alt="bon" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '48px', height: '48px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Receipt size={20} style={{ color: 'var(--text-3)' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px', color: 'var(--text)' }}>{sub.vendor}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
                    {sub.category} · {new Date(sub.created_at).toLocaleDateString('nl-NL')}
                    {sub.description && <> · {sub.description}</>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>€ {Number(sub.amount).toFixed(2)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Icon size={10} /> {st.label}
                    </span>
                  </div>
                  {sub.reviewer_notes && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{sub.reviewer_notes}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
