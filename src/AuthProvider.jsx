import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'

const AuthContext = createContext(null)

// Org context — set when an accountant "jumps into" a client org
export const OrgDataContext = createContext(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Wraps the App with a specific org's data context (used by AccountantPortal)
export const OrgDataProvider = ({ orgId, readOnly, children }) => (
  <OrgDataContext.Provider value={{ orgId, readOnly }}>
    {children}
  </OrgDataContext.Provider>
)

// Mapping: storage key → Supabase tabel + modus
const TABLE_CONFIG = {
  settings:          { table: 'user_settings',    mode: 'single' },
  clients:           { table: 'clients',           mode: 'array'  },
  invoices:          { table: 'invoices',          mode: 'array'  },
  expenses:          { table: 'expenses',          mode: 'array'  },
  entities:          { table: 'entities',          mode: 'array'  },
  quotes:            { table: 'quotes',            mode: 'array'  },
  horizonData:       { table: 'horizon_data',      mode: 'single' },
  boek_assets:       { table: 'boek_assets',       mode: 'array'  },
  boek_entries:      { table: 'boek_entries',      mode: 'array'  },
  purchase_invoices: { table: 'purchase_invoices', mode: 'array'  },
}

// Cloud-synced storage hook
// — Elke sleutel heeft nu zijn eigen Supabase-tabel
// — Inside OrgDataProvider: filtert op org_id (gedeelde data voor accountant)
// — Otherwise: filtert op user_id (persoonlijke data)
export const useCloudStorage = (key, defaultValue) => {
  const { user } = useContext(AuthContext) || {}
  const { orgId, readOnly } = useContext(OrgDataContext) || {}

  const storageKey = orgId ? `org_${orgId}_${key}` : user ? `${user.id}_${key}` : key
  const [value, setValue] = useState(defaultValue)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      const cfg = TABLE_CONFIG[key]
      if (isSupabaseConfigured && cfg && (user || orgId)) {
        try {
          const idField = orgId ? 'org_id' : 'user_id'
          const idValue = orgId || user.id

          if (cfg.mode === 'single') {
            const { data: row } = await supabase
              .from(cfg.table)
              .select('data')
              .eq(idField, idValue)
              .maybeSingle()
            if (row?.data != null) {
              setValue(row.data)
              try { localStorage.setItem(storageKey, JSON.stringify(row.data)) } catch {}
              setLoaded(true)
              return
            }
          } else {
            const { data: rows } = await supabase
              .from(cfg.table)
              .select('data')
              .eq(idField, idValue)
              .order('created_at', { ascending: true })
            if (rows) {
              const arr = rows.map(r => r.data)
              setValue(arr)
              try { localStorage.setItem(storageKey, JSON.stringify(arr)) } catch {}
              setLoaded(true)
              return
            }
          }
        } catch {}
      }
      // Fallback: localStorage
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) setValue(JSON.parse(raw))
      } catch {}
      setLoaded(true)
    }
    load()
  }, [user?.id, orgId, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (newValue) => {
    if (readOnly) return
    const resolved = typeof newValue === 'function' ? newValue(value) : newValue
    setValue(resolved)
    try { localStorage.setItem(storageKey, JSON.stringify(resolved)) } catch {}

    const cfg = TABLE_CONFIG[key]
    if (!isSupabaseConfigured || !cfg || (!user && !orgId)) return

    const idField = orgId ? 'org_id' : 'user_id'
    const idValue = orgId || user.id

    try {
      if (cfg.mode === 'single') {
        await supabase.from(cfg.table).upsert(
          { [idField]: idValue, data: resolved, updated_at: new Date().toISOString() },
          { onConflict: idField }
        )
      } else {
        const arr = Array.isArray(resolved) ? resolved : []

        // Upsert alle huidige items
        if (arr.length > 0) {
          const rows = arr.map(item => ({
            id: item.id,
            [idField]: idValue,
            entity_id: item.entityId || null,
            status: item.status || null,
            item_date: item.date || item.invoiceDate || item.quoteDate || null,
            total: item.total ?? item.totalAmount ?? item.amount ?? null,
            data: item,
            updated_at: new Date().toISOString(),
          }))
          await supabase.from(cfg.table).upsert(rows, { onConflict: 'id' })
        }

        // Verwijder items die niet meer in de array zitten
        const keepIds = arr.map(i => i?.id).filter(Boolean)
        const { data: existing } = await supabase
          .from(cfg.table).select('id').eq(idField, idValue)
        const toDelete = (existing || []).map(r => r.id).filter(id => !keepIds.includes(id))
        if (toDelete.length > 0) {
          await supabase.from(cfg.table).delete().in('id', toDelete)
        }
      }
    } catch (e) {
      console.warn('Supabase sync failed:', e.message)
    }
  }

  return [value, save, loaded]
}

const QUICK_LOGIN_KEY = 'dhs_quick_login'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    if (!isSupabaseConfigured) return
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data)
    } catch {}
  }

  useEffect(() => {
    // Check for quick-login bypass (local demo user)
    const quickRaw = localStorage.getItem(QUICK_LOGIN_KEY)
    if (quickRaw) {
      try {
        const quickUser = JSON.parse(quickRaw)
        // Synthetic user object (mimics Supabase user shape)
        const syntheticUser = { id: 'local_admin', email: quickUser.email, isLocal: true }
        const syntheticProfile = {
          id: 'local_admin', email: quickUser.email,
          full_name: quickUser.name, role: quickUser.role,
          organization_id: null,
        }
        setUser(syntheticUser)
        setProfile(syntheticProfile)
        setLoading(false)
        return
      } catch {
        localStorage.removeItem(QUICK_LOGIN_KEY)
      }
    }

    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase niet geconfigureerd.' } }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signUp = async (email, password, fullName, inviteCode) => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase niet geconfigureerd.' } }

    // Check invite code → employee joining an org
    let orgId = null
    if (inviteCode) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('invite_code', inviteCode.trim().toLowerCase())
        .single()
      if (org) orgId = org.id
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (!error && data.user && orgId) {
      // Update profile with org + employee role
      await supabase
        .from('profiles')
        .update({ organization_id: orgId, role: 'employee' })
        .eq('id', data.user.id)
    }

    return { data, error }
  }

  const quickLogin = (userData) => {
    const syntheticUser = { id: 'local_admin', email: userData.email, isLocal: true }
    const syntheticProfile = {
      id: 'local_admin', email: userData.email,
      full_name: userData.name, role: userData.role,
      organization_id: null,
    }
    try { localStorage.setItem(QUICK_LOGIN_KEY, JSON.stringify(userData)) } catch {}
    setUser(syntheticUser)
    setProfile(syntheticProfile)
    setLoading(false)
  }

  const signOut = async () => {
    localStorage.removeItem(QUICK_LOGIN_KEY)
    if (supabase && !user?.isLocal) await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const updateProfile = async (updates) => {
    if (!user || !isSupabaseConfigured) return
    await supabase.from('profiles').update(updates).eq('id', user.id)
    setProfile(p => ({ ...p, ...updates }))
  }

  const isPlatformAdmin = profile?.role === 'platform_admin'
  const isOrgOwner = profile?.role === 'org_owner' || isPlatformAdmin
  const isAccountant = profile?.role === 'accountant' || isPlatformAdmin
  const isEmployee = profile?.role === 'employee'
  const isReadOnly = profile?.access_type === 'meekijk'

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signUp, signOut, quickLogin, updateProfile,
      isPlatformAdmin, isOrgOwner, isAccountant, isEmployee, isReadOnly,
      isConfigured: isSupabaseConfigured,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
