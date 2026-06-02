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

// ── Veld-mappers: app-formaat ↔ DB-kolommen ──────────────────

const invoiceFromDB = (row) => ({
  ...row.extra,
  id: row.id, entityId: row.entity_id, clientId: row.client_id,
  invoiceNumber: row.number, issueDate: row.issue_date, date: row.issue_date,
  dueDate: row.due_date, status: row.status, currency: row.currency,
  notes: row.notes, internalNotes: row.internal_notes, subject: row.subject,
  subtotal: row.subtotal, btwTotal: row.btw_total, total: row.total,
  paidAmount: row.paid_amount, sentAt: row.sent_at, paidAt: row.paid_at,
  signToken: row.sign_token, signedAt: row.signed_at,
  signedByName: row.signed_by_name, signedByIp: row.signed_by_ip,
  createdAt: row.created_at,
  items: (row.invoice_items || [])
    .sort((a,b) => a.sort_order - b.sort_order)
    .map(it => ({
      id: it.id, description: it.description,
      quantity: it.quantity, price: it.unit_price,
      btwRate: it.btw_rate, lineNet: it.line_net,
      discount: it.discount_type ? { type: it.discount_type, value: it.discount_value, name: it.discount_name } : null,
    })),
  remindersSent: (row.invoice_reminders || []),
})

const invoiceToDB = (item, orgId) => ({
  id: item.id, org_id: orgId,
  entity_id: item.entityId || null, client_id: item.clientId || null,
  number: item.invoiceNumber || item.number || '',
  issue_date: item.issueDate || item.date || new Date().toISOString().split('T')[0],
  due_date: item.dueDate || null, status: item.status || 'draft',
  currency: item.currency || 'EUR', notes: item.notes || null,
  internal_notes: item.internalNotes || null, subject: item.subject || null,
  subtotal: item.subtotal ?? null, btw_total: item.btwTotal ?? null,
  total: item.total ?? null, paid_amount: item.paidAmount ?? 0,
  sent_at: item.sentAt || null, paid_at: item.paidAt || null,
  sign_token: item.signToken || null, signed_at: item.signedAt || null,
  signed_by_name: item.signedByName || null, signed_by_ip: item.signedByIp || null,
  extra: {},
  updated_at: new Date().toISOString(),
})

const itemsToDB = (items, parentId, parentKey) =>
  (items || []).map((it, idx) => ({
    [parentKey]: parentId, sort_order: idx,
    description: it.description || '', quantity: it.quantity ?? 1,
    unit_price: it.price ?? it.unit_price ?? 0, btw_rate: it.btwRate ?? 21,
    discount_type: it.discount?.type || null,
    discount_value: it.discount?.value ?? 0,
    discount_name: it.discount?.name || null,
    line_net: it.lineNet ?? null,
  }))

const quoteFromDB = (row) => ({
  ...row.extra,
  id: row.id, entityId: row.entity_id, clientId: row.client_id,
  quoteNumber: row.number, issueDate: row.issue_date, date: row.issue_date,
  validUntil: row.valid_until, status: row.status, currency: row.currency,
  notes: row.notes, subject: row.subject,
  subtotal: row.subtotal, btwTotal: row.btw_total, total: row.total,
  signToken: row.sign_token, signedAt: row.signed_at,
  signedByName: row.signed_by_name, sentAt: row.sent_at,
  convertedToInvoiceId: row.converted_to_invoice_id, createdAt: row.created_at,
  items: (row.quote_items || [])
    .sort((a,b) => a.sort_order - b.sort_order)
    .map(it => ({
      id: it.id, description: it.description,
      quantity: it.quantity, price: it.unit_price, btwRate: it.btw_rate,
      discount: it.discount_type ? { type: it.discount_type, value: it.discount_value, name: it.discount_name } : null,
    })),
})

const quoteToDB = (item, orgId) => ({
  id: item.id, org_id: orgId,
  entity_id: item.entityId || null, client_id: item.clientId || null,
  number: item.quoteNumber || item.number || '',
  issue_date: item.issueDate || item.date || new Date().toISOString().split('T')[0],
  valid_until: item.validUntil || null, status: item.status || 'draft',
  currency: item.currency || 'EUR', notes: item.notes || null, subject: item.subject || null,
  subtotal: item.subtotal ?? null, btw_total: item.btwTotal ?? null, total: item.total ?? null,
  sign_token: item.signToken || null, signed_at: item.signedAt || null,
  signed_by_name: item.signedByName || null, sent_at: item.sentAt || null,
  converted_to_invoice_id: item.convertedToInvoiceId || null,
  extra: {}, updated_at: new Date().toISOString(),
})

const clientFromDB = (row) => ({
  ...row.extra, id: row.id, entityId: row.entity_id, name: row.name,
  contactName: row.contact_name, email: row.email, phone: row.phone,
  address: row.address, postal: row.postal, city: row.city, country: row.country,
  btw: row.btw_number, kvk: row.kvk_number, notes: row.notes,
  isActive: row.is_active, createdAt: row.created_at,
})

const clientToDB = (item, orgId) => ({
  id: item.id, org_id: orgId, entity_id: item.entityId || null,
  name: item.name || '', contact_name: item.contactName || null,
  email: item.email || null, phone: item.phone || null,
  address: item.address || null, postal: item.postal || null,
  city: item.city || null, country: item.country || 'Nederland',
  btw_number: item.btw || item.btwNumber || null,
  kvk_number: item.kvk || item.kvkNumber || null,
  notes: item.notes || null, is_active: item.isActive !== false,
  extra: {}, updated_at: new Date().toISOString(),
})

const pinvFromDB = (row) => ({
  ...row.extra, id: row.id, entityId: row.entity_id,
  supplier: row.supplier, invoiceNumber: row.invoice_number,
  date: row.date, dueDate: row.due_date,
  amount: row.amount_excl, btwRate: row.btw_rate, btwAmount: row.btw_amount,
  totalAmount: row.total_amount, currency: row.currency, category: row.category,
  ledgerCode: row.ledger_code, status: row.status, paidAt: row.paid_at,
  attachment: row.attachment_url, attachmentName: row.attachment_name,
  notes: row.notes, recurring: row.recurring, recurringPeriod: row.recurring_period,
  createdAt: row.created_at,
})

const pinvToDB = (item, orgId) => ({
  id: item.id, org_id: orgId, entity_id: item.entityId || null,
  supplier: item.supplier || '', invoice_number: item.invoiceNumber || null,
  date: item.date || null, due_date: item.dueDate || null,
  amount_excl: item.amount ?? null, btw_rate: item.btwRate ?? 21,
  btw_amount: item.btwAmount ?? null, total_amount: item.totalAmount ?? null,
  currency: item.currency || 'EUR', category: item.category || null,
  ledger_code: item.ledgerCode || null, status: item.status || 'unpaid',
  paid_at: item.paidAt || null,
  attachment_url: item.attachment && item.attachment.startsWith('http') ? item.attachment : null,
  attachment_name: item.attachmentName || null,
  notes: item.notes || null, recurring: item.recurring || false,
  recurring_period: item.recurringPeriod || null,
  extra: item.attachment && !item.attachment.startsWith('http') ? { attachment: item.attachment } : {},
  updated_at: new Date().toISOString(),
})

const expenseFromDB = (row) => ({
  ...row.extra, id: row.id, entityId: row.entity_id,
  description: row.description, vendor: row.vendor, date: row.date,
  amountIncl: row.amount_incl, btwRate: row.btw_rate, btwAmount: row.btw_amount,
  amountExcl: row.amount_excl, category: row.category, ledgerCode: row.ledger_code,
  currency: row.currency, receiptUrl: row.receipt_url, receiptName: row.receipt_name,
  notes: row.notes, createdAt: row.created_at,
})

const expenseToDB = (item, orgId, userId) => ({
  id: item.id, org_id: orgId, entity_id: item.entityId || null,
  description: item.description || '', vendor: item.vendor || null,
  date: item.date || new Date().toISOString().split('T')[0],
  amount_incl: item.amountIncl ?? item.total ?? 0,
  btw_rate: item.btwRate ?? 21, btw_amount: item.btwAmount ?? null,
  amount_excl: item.amountExcl ?? null, category: item.category || null,
  ledger_code: item.ledgerCode || null, currency: item.currency || 'EUR',
  receipt_url: item.receiptUrl || null, receipt_name: item.receiptName || null,
  notes: item.notes || null, created_by: userId || null,
  extra: {},
})

const entityFromDB = (row) => ({
  ...row.extra, id: row.id, orgId: row.org_id, name: row.name,
  jurisdiction: row.jurisdiction, currency: row.currency,
  invoicePrefix: row.invoice_prefix, nextInvoiceNumber: row.next_invoice_number,
  paymentTerms: row.payment_terms, defaultBtwRate: row.default_btw_rate,
  isActive: row.is_active, createdAt: row.created_at,
})

const entityToDB = (item, orgId) => {
  const knownKeys = new Set(['id', 'orgId', 'name', 'jurisdiction', 'currency', 'invoicePrefix', 'nextInvoiceNumber', 'paymentTerms', 'defaultBtwRate', 'isActive', 'createdAt'])
  const extra = {}
  Object.entries(item).forEach(([k, v]) => { if (!knownKeys.has(k)) extra[k] = v })
  return {
    id: item.id, org_id: orgId, name: item.name || '',
    jurisdiction: item.jurisdiction || 'NL', currency: item.currency || 'EUR',
    invoice_prefix: item.invoicePrefix || '2026-',
    next_invoice_number: item.nextInvoiceNumber || 1,
    payment_terms: item.paymentTerms || 14,
    default_btw_rate: item.defaultBtwRate || 21,
    is_active: item.isActive !== false,
    extra,
  }
}

const boekAssetFromDB = (row) => ({
  ...row.extra, id: row.id, entityId: row.entity_id, name: row.name,
  category: row.category, purchaseDate: row.purchase_date,
  purchaseValue: row.purchase_value, residualValue: row.residual_value,
  depreciationYears: row.depreciation_years, isActive: row.is_active,
  notes: row.notes, createdAt: row.created_at,
})

const boekAssetToDB = (item, orgId) => ({
  id: item.id, org_id: orgId, entity_id: item.entityId || null,
  name: item.name || '', category: item.category || null,
  purchase_date: item.purchaseDate || item.purchasedate || null,
  purchase_value: item.purchaseValue ?? item.purchasevalue ?? null,
  residual_value: item.residualValue ?? 0,
  depreciation_years: item.depreciationYears ?? 5,
  is_active: item.isActive !== false, notes: item.notes || null, extra: {},
})

const boekEntryFromDB = (row) => ({
  ...row.extra, id: row.id, entityId: row.entity_id, date: row.date,
  category: row.category, description: row.description, amount: row.amount,
  isDebit: row.is_debit, ledgerCode: row.ledger_code, reference: row.reference,
  createdAt: row.created_at,
})

const boekEntryToDB = (item, orgId) => ({
  id: item.id, org_id: orgId, entity_id: item.entityId || null,
  date: item.date || new Date().toISOString().split('T')[0],
  category: item.category || null, description: item.description || null,
  amount: item.amount ?? null, is_debit: item.isDebit !== false,
  ledger_code: item.ledgerCode || null, reference: item.reference || null, extra: {},
})

// Mapping: storage key → Supabase tabel + modus
const TABLE_CONFIG = {
  settings: {
    table: 'org_settings', mode: 'single', idField: 'org_id',
    fromDB: (row) => {
      const { org_id, updated_at, extra, ...rest } = row
      const snake2camel = (s) => s.replace(/_([a-z])/g, (_,c) => c.toUpperCase())
      const out = {}
      Object.entries(rest).forEach(([k,v]) => { out[snake2camel(k)] = v })
      return { ...out, ...(extra || {}) }
    },
    toDB: (val, orgId) => {
      const camel2snake = (s) => s.replace(/([A-Z])/g, '_$1').toLowerCase()
      const row = { org_id: orgId, extra: {}, updated_at: new Date().toISOString() }
      const knownKeys = ['company_name','company_address','company_postal','company_city','company_country','company_kvk','company_btw','company_iban','company_bic','company_email','company_phone','company_website','company_logo_url','invoice_prefix','invoice_footer','invoice_accent_color','default_btw_rate','payment_terms','email_from_name','email_from_email','resend_api_key','whatsapp_number','reminders_enabled','reminder_days','jurisdiction','base_currency','enabled_currencies','credit_mgmt_enabled','late_payment_threshold','high_value_threshold']
      Object.entries(val || {}).forEach(([k,v]) => {
        const sk = camel2snake(k)
        if (knownKeys.includes(sk)) row[sk] = v
        else row.extra[k] = v
      })
      return row
    },
  },
  clients: {
    table: 'clients', mode: 'array',
    fromDB: clientFromDB, toDB: clientToDB,
    select: '*',
  },
  invoices: {
    table: 'invoices', mode: 'array',
    fromDB: invoiceFromDB, toDB: invoiceToDB,
    select: '*, invoice_items(*), invoice_reminders(*)',
    childTable: 'invoice_items', childKey: 'invoice_id',
    childToDB: (items, parentId) => itemsToDB(items, parentId, 'invoice_id'),
  },
  expenses: {
    table: 'expenses', mode: 'array',
    fromDB: expenseFromDB, toDB: expenseToDB,
    select: '*',
  },
  entities: {
    table: 'entities', mode: 'array',
    fromDB: entityFromDB, toDB: entityToDB,
    select: '*',
  },
  quotes: {
    table: 'quotes', mode: 'array',
    fromDB: quoteFromDB, toDB: quoteToDB,
    select: '*, quote_items(*)',
    childTable: 'quote_items', childKey: 'quote_id',
    childToDB: (items, parentId) => itemsToDB(items, parentId, 'quote_id'),
  },
  horizonData: {
    table: 'horizon_scenarios', mode: 'horizon',
  },
  boek_assets: {
    table: 'boek_assets', mode: 'array',
    fromDB: boekAssetFromDB, toDB: boekAssetToDB,
    select: '*',
  },
  boek_entries: {
    table: 'boek_entries', mode: 'array',
    fromDB: boekEntryFromDB, toDB: boekEntryToDB,
    select: '*',
  },
  purchase_invoices: {
    table: 'purchase_invoices', mode: 'array',
    fromDB: pinvFromDB, toDB: pinvToDB,
    select: '*',
  },
}

// Cloud-synced storage hook
// — Elke sleutel heeft zijn eigen Supabase-tabel via TABLE_CONFIG
// — orgId: uit OrgDataContext (accountant die in een org kijkt) OF uit profile.organization_id
export const useCloudStorage = (key, defaultValue) => {
  const { user, profile } = useContext(AuthContext) || {}
  const { orgId: ctxOrgId, readOnly } = useContext(OrgDataContext) || {}

  const orgId = ctxOrgId || profile?.organization_id || null
  const storageKey = orgId ? `org_${orgId}_${key}` : user ? `${user.id}_${key}` : key

  const [value, setValue] = useState(defaultValue)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      const cfg = TABLE_CONFIG[key]
      if (isSupabaseConfigured && cfg && orgId) {
        try {
          if (cfg.mode === 'single') {
            const { data: row } = await supabase
              .from(cfg.table)
              .select('*')
              .eq('org_id', orgId)
              .maybeSingle()
            if (row) {
              const parsed = cfg.fromDB(row)
              setValue(parsed)
              try { localStorage.setItem(storageKey, JSON.stringify(parsed)) } catch {}
              setLoaded(true)
              return
            }
          } else if (cfg.mode === 'array') {
            const { data: rows } = await supabase
              .from(cfg.table)
              .select(cfg.select || '*')
              .eq('org_id', orgId)
              .order('created_at', { ascending: true })
            if (rows) {
              const arr = rows.map(r => cfg.fromDB(r))
              setValue(arr)
              try { localStorage.setItem(storageKey, JSON.stringify(arr)) } catch {}
              setLoaded(true)
              return
            }
          } else if (cfg.mode === 'horizon') {
            const { data: rows } = await supabase
              .from(cfg.table)
              .select('*')
              .eq('org_id', orgId)
            if (rows && rows.length > 0) {
              const obj = {}
              rows.forEach(r => { obj[r.entity_id || 'default'] = r.data })
              setValue(obj)
              try { localStorage.setItem(storageKey, JSON.stringify(obj)) } catch {}
              setLoaded(true)
              return
            }
          }
        } catch (e) {
          console.warn('Supabase load failed:', e.message)
        }
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
    if (!isSupabaseConfigured || !cfg || !orgId) return

    try {
      if (cfg.mode === 'single') {
        const row = cfg.toDB(resolved, orgId)
        await supabase.from(cfg.table).upsert(row, { onConflict: 'org_id' })

      } else if (cfg.mode === 'array') {
        const arr = Array.isArray(resolved) ? resolved : []

        // Upsert alle huidige items
        if (arr.length > 0) {
          const rows = arr.map(item => cfg.toDB(item, orgId, user?.id))
          await supabase.from(cfg.table).upsert(rows, { onConflict: 'id' })

          // Vervang child-regels (invoice_items, quote_items)
          if (cfg.childTable && cfg.childToDB) {
            for (const item of arr) {
              if (!item.id) continue
              await supabase.from(cfg.childTable).delete().eq(cfg.childKey, item.id)
              const childRows = cfg.childToDB(item.items || [], item.id)
              if (childRows.length > 0) {
                await supabase.from(cfg.childTable).insert(childRows)
              }
            }
          }
        }

        // Verwijder items die niet meer in de array zitten
        const keepIds = arr.map(i => i?.id).filter(Boolean)
        const { data: existing } = await supabase
          .from(cfg.table).select('id').eq('org_id', orgId)
        const toDelete = (existing || []).map(r => r.id).filter(id => !keepIds.includes(id))
        if (toDelete.length > 0) {
          await supabase.from(cfg.table).delete().in('id', toDelete)
        }

      } else if (cfg.mode === 'horizon') {
        const obj = resolved || {}
        for (const [entityId, data] of Object.entries(obj)) {
          const eId = entityId === 'default' ? null : entityId
          // Zoek bestaande rij (geen unique constraint, dus select-then-update)
          let q = supabase.from(cfg.table).select('id').eq('org_id', orgId)
          q = eId ? q.eq('entity_id', eId) : q.is('entity_id', null)
          const { data: existing } = await q.maybeSingle()
          if (existing?.id) {
            await supabase.from(cfg.table)
              .update({ data, updated_at: new Date().toISOString() })
              .eq('id', existing.id)
          } else {
            await supabase.from(cfg.table).insert({
              org_id: orgId, entity_id: eId, data,
              name: 'Horizon', year: new Date().getFullYear(),
            })
          }
        }
      }
    } catch (e) {
      console.warn('Supabase sync failed:', e.message)
    }
  }

  return [value, save, loaded]
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const fetchOrg = async (orgId) => {
    if (!isSupabaseConfigured || !orgId) return
    try {
      const { data } = await supabase.from('organizations').select('id, name, plan').eq('id', orgId).single()
      if (data) setOrganization(data)
    } catch {}
  }

  const fetchProfile = async (userId) => {
    if (!isSupabaseConfigured) return
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) {
        console.warn('[fetchProfile] Supabase error:', error.message)
        return
      }
      if (data) {
        setProfile(data)
        if (data.organization_id) fetchOrg(data.organization_id)
      }
    } catch (e) {
      console.warn('[fetchProfile] Exception:', e.message)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    // Verwijder eventuele oude quick-login sessie
    localStorage.removeItem('dhs_quick_login')

    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // Only re-fetch profile on actual sign-in events, not on token refreshes.
        // Token refreshes would overwrite local profile state (incl. organization_id) with DB data.
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          fetchProfile(session.user.id)
        }
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

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut({ scope: 'local' })
    setUser(null)
    setProfile(null)
    setOrganization(null)
  }

  const updateProfile = async (updates) => {
    if (!user || !isSupabaseConfigured) return
    await supabase.from('profiles').update(updates).eq('id', user.id)
    setProfile(p => ({ ...p, ...updates }))
  }

  const createOrg = async (name) => {
    if (!isSupabaseConfigured || !user) return { error: new Error('Niet geconfigureerd') }
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: name.trim(), plan: 'starter' })
      .select()
      .single()
    if (orgErr) return { error: orgErr }
    const roleUpdate = profile?.role === 'platform_admin' ? {} : { role: 'org_owner' }
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ organization_id: org.id, ...roleUpdate })
      .eq('id', user.id)
    if (!profileErr) {
      setProfile(p => ({ ...p, organization_id: org.id, ...roleUpdate }))
      setOrganization(org)
    }
    return { data: org, error: profileErr }
  }

  const updateOrganization = async (updates) => {
    if (!isSupabaseConfigured || !organization?.id) return
    await supabase.from('organizations').update(updates).eq('id', organization.id)
    setOrganization(o => ({ ...o, ...updates }))
  }

  const isPlatformAdmin = profile?.role === 'platform_admin'
  const isOrgOwner = profile?.role === 'org_owner' || isPlatformAdmin
  const isAccountant = profile?.role === 'accountant' || isPlatformAdmin
  const isEmployee = profile?.role === 'employee'
  const isReadOnly = profile?.access_type === 'meekijk'

  return (
    <AuthContext.Provider value={{
      user, profile, organization, loading, profileLoading,
      signIn, signUp, signOut, updateProfile, createOrg, updateOrganization,
      isPlatformAdmin, isOrgOwner, isAccountant, isEmployee, isReadOnly,
      isConfigured: isSupabaseConfigured,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
