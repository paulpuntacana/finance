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

// Cloud-synced storage hook
// — When inside OrgDataProvider: uses org_data table (shared between accountant + org members)
// — Otherwise: uses user_data table (personal, keyed by user.id)
export const useCloudStorage = (key, defaultValue) => {
  const { user } = useContext(AuthContext) || {}
  const { orgId, readOnly } = useContext(OrgDataContext) || {}

  // Local cache key
  const storageKey = orgId ? `org_${orgId}_${key}` : user ? `${user.id}_${key}` : key

  const [value, setValue] = useState(defaultValue)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (isSupabaseConfigured && (user || orgId)) {
        try {
          if (orgId) {
            // Org-level shared data
            const { data } = await supabase
              .from('org_data')
              .select(key)
              .eq('org_id', orgId)
              .single()
            if (data && data[key] !== null && data[key] !== undefined) {
              setValue(data[key])
              try { localStorage.setItem(storageKey, JSON.stringify(data[key])) } catch {}
              setLoaded(true)
              return
            }
          } else if (user) {
            // Personal user data
            const { data } = await supabase
              .from('user_data')
              .select(key)
              .eq('user_id', user.id)
              .single()
            if (data && data[key] !== null && data[key] !== undefined) {
              setValue(data[key])
              try { localStorage.setItem(storageKey, JSON.stringify(data[key])) } catch {}
              setLoaded(true)
              return
            }
          }
        } catch {}
      }
      // Fall back to localStorage
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) setValue(JSON.parse(raw))
      } catch {}
      setLoaded(true)
    }
    load()
  }, [user?.id, orgId, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (newValue) => {
    if (readOnly) return // meekijk accounts cannot write
    const resolved = typeof newValue === 'function' ? newValue(value) : newValue
    setValue(resolved)
    try { localStorage.setItem(storageKey, JSON.stringify(resolved)) } catch {}
    if (isSupabaseConfigured && (user || orgId)) {
      try {
        if (orgId) {
          await supabase.from('org_data').upsert({
            org_id: orgId,
            [key]: resolved,
            updated_at: new Date().toISOString(),
          })
        } else if (user) {
          await supabase.from('user_data').upsert({
            user_id: user.id,
            [key]: resolved,
            updated_at: new Date().toISOString(),
          })
        }
      } catch (e) {
        console.warn('Supabase sync failed:', e.message)
      }
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
