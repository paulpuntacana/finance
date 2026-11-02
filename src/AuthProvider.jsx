import { createContext, useContext, useState, useEffect, useRef } from 'react'
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
// Elk veld dat geen eigen kolom heeft gaat naar `extra` (jsonb), zodat er bij een
// sync nooit meer stilletjes velden verdwijnen (payments, creditNoteFor, vatTreatment, …).

const todayStr = () => new Date().toISOString().split('T')[0]

const packExtra = (item, knownKeys) => {
  const extra = {}
  Object.entries(item || {}).forEach(([k, v]) => {
    if (!knownKeys.has(k) && v !== undefined) extra[k] = v
  })
  return extra
}

// Dubbele child-regels (ontstaan door gelijktijdige saves in de oude sync) wegfilteren:
// zelfde sort_order = zelfde regel. Houdt de eerste.
const dedupeChildRows = (rows) => {
  const seen = new Set()
  return (rows || [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .filter(r => {
      const key = r.sort_order ?? r.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const childFromDB = (it) => ({
  id: it.id, description: it.description,
  quantity: Number(it.quantity), price: Number(it.unit_price),
  btwRate: Number(it.btw_rate), lineNet: it.line_net,
  discount: it.discount_type ? { type: it.discount_type, value: Number(it.discount_value), name: it.discount_name } : null,
})

const INVOICE_KEYS = new Set(['id', 'entityId', 'clientId', 'invoiceNumber', 'number', 'issueDate', 'date', 'dueDate', 'status', 'currency', 'notes', 'internalNotes', 'subject', 'subtotal', 'btwTotal', 'total', 'paidAmount', 'sentAt', 'paidAt', 'signToken', 'signedAt', 'signedByName', 'signedByIp', 'createdAt', 'updatedAt', 'items'])

const invoiceFromDB = (row) => {
  const extra = row.extra || {}
  return {
    ...extra,
    id: row.id, entityId: row.entity_id, clientId: row.client_id,
    invoiceNumber: row.number, number: row.number, issueDate: row.issue_date, date: row.issue_date,
    dueDate: row.due_date, status: row.status, currency: row.currency,
    notes: row.notes, internalNotes: row.internal_notes, subject: row.subject,
    subtotal: row.subtotal, btwTotal: row.btw_total, total: row.total,
    paidAmount: row.paid_amount, sentAt: row.sent_at, paidAt: row.paid_at,
    signToken: row.sign_token, signedAt: row.signed_at,
    signedByName: row.signed_by_name, signedByIp: row.signed_by_ip,
    createdAt: row.created_at,
    items: dedupeChildRows(row.invoice_items).map(childFromDB),
    remindersSent: extra.remindersSent || row.invoice_reminders || [],
  }
}

const invoiceToDB = (item, orgId) => ({
  id: item.id, org_id: orgId,
  entity_id: item.entityId || null, client_id: item.clientId || null,
  number: item.number || item.invoiceNumber || '',
  issue_date: item.issueDate || item.date || todayStr(),
  due_date: item.dueDate || null, status: item.status || 'draft',
  currency: item.currency || 'EUR', notes: item.notes || null,
  internal_notes: item.internalNotes || null, subject: item.subject || null,
  subtotal: item.subtotal ?? null, btw_total: item.btwTotal ?? null,
  total: item.total ?? null, paid_amount: item.paidAmount ?? 0,
  sent_at: item.sentAt || null, paid_at: item.paidAt || null,
  sign_token: item.signToken || null, signed_at: item.signedAt || null,
  signed_by_name: item.signedByName || null, signed_by_ip: item.signedByIp || null,
  extra: packExtra(item, INVOICE_KEYS),
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

const QUOTE_KEYS = new Set(['id', 'entityId', 'clientId', 'quoteNumber', 'number', 'issueDate', 'date', 'validUntil', 'status', 'currency', 'notes', 'subject', 'subtotal', 'btwTotal', 'total', 'signToken', 'signedAt', 'signedByName', 'sentAt', 'convertedToInvoiceId', 'createdAt', 'updatedAt', 'items'])

const quoteFromDB = (row) => ({
  ...(row.extra || {}),
  id: row.id, entityId: row.entity_id, clientId: row.client_id,
  quoteNumber: row.number, number: row.number, issueDate: row.issue_date, date: row.issue_date,
  validUntil: row.valid_until, status: row.status, currency: row.currency,
  notes: row.notes, subject: row.subject,
  subtotal: row.subtotal, btwTotal: row.btw_total, total: row.total,
  signToken: row.sign_token, signedAt: row.signed_at,
  signedByName: row.signed_by_name, sentAt: row.sent_at,
  convertedToInvoiceId: row.converted_to_invoice_id, createdAt: row.created_at,
  items: dedupeChildRows(row.quote_items).map(childFromDB),
})

const quoteToDB = (item, orgId) => ({
  id: item.id, org_id: orgId,
  entity_id: item.entityId || null, client_id: item.clientId || null,
  number: item.number || item.quoteNumber || '',
  issue_date: item.issueDate || item.date || todayStr(),
  valid_until: item.validUntil || null, status: item.status || 'draft',
  currency: item.currency || 'EUR', notes: item.notes || null, subject: item.subject || null,
  subtotal: item.subtotal ?? null, btw_total: item.btwTotal ?? null, total: item.total ?? null,
  sign_token: item.signToken || null, signed_at: item.signedAt || null,
  signed_by_name: item.signedByName || null, sent_at: item.sentAt || null,
  converted_to_invoice_id: item.convertedToInvoiceId || null,
  extra: packExtra(item, QUOTE_KEYS), updated_at: new Date().toISOString(),
})

const CLIENT_KEYS = new Set(['id', 'entityId', 'name', 'contactName', 'email', 'phone', 'address', 'postal', 'city', 'country', 'btw', 'btwNumber', 'kvk', 'kvkNumber', 'notes', 'isActive', 'createdAt', 'updatedAt'])

const clientFromDB = (row) => ({
  ...(row.extra || {}), id: row.id, entityId: row.entity_id, name: row.name,
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
  extra: packExtra(item, CLIENT_KEYS), updated_at: new Date().toISOString(),
})

const PINV_KEYS = new Set(['id', 'entityId', 'supplier', 'invoiceNumber', 'date', 'dueDate', 'amount', 'btwRate', 'btwAmount', 'totalAmount', 'currency', 'category', 'ledgerCode', 'status', 'paidAt', 'attachmentName', 'notes', 'recurring', 'recurringPeriod', 'createdAt', 'updatedAt', 'attachment'])

const pinvFromDB = (row) => ({
  ...(row.extra || {}), id: row.id, entityId: row.entity_id,
  supplier: row.supplier, invoiceNumber: row.invoice_number,
  date: row.date, dueDate: row.due_date,
  amount: row.amount_excl, btwRate: row.btw_rate, btwAmount: row.btw_amount,
  totalAmount: row.total_amount, currency: row.currency, category: row.category,
  ledgerCode: row.ledger_code, status: row.status, paidAt: row.paid_at,
  attachment: row.attachment_url || row.extra?.attachment || null, attachmentName: row.attachment_name,
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
  extra: {
    ...packExtra(item, PINV_KEYS),
    ...(item.attachment && !item.attachment.startsWith('http') ? { attachment: item.attachment } : {}),
  },
  updated_at: new Date().toISOString(),
})

// `amount` (EUR incl. BTW) en `ledgerAccount` zijn de velden die de app gebruikt; ze staan
// zowel in de kolommen als in extra (extra wint bij het laden, zodat er niets afrondt).
const EXPENSE_KEYS = new Set(['id', 'entityId', 'description', 'vendor', 'amountIncl', 'amountExcl', 'btwRate', 'btwAmount', 'category', 'ledgerCode', 'currency', 'receiptUrl', 'receiptName', 'notes', 'createdAt', 'date'])

const expenseFromDB = (row) => {
  const extra = row.extra || {}
  return {
    ...extra, id: row.id, entityId: row.entity_id,
    description: row.description, vendor: row.vendor,
    // Open bonnen hebben nog geen datum; de kolom is NOT NULL, dus we onthouden dat in extra.
    date: extra.dateMissing ? '' : row.date,
    amountIncl: row.amount_incl, btwRate: row.btw_rate, btwAmount: row.btw_amount,
    amountExcl: row.amount_excl, category: row.category, ledgerCode: row.ledger_code,
    currency: row.currency, receiptUrl: row.receipt_url, receiptName: row.receipt_name,
    notes: row.notes, createdAt: row.created_at,
    amount: extra.amount ?? row.amount_incl,
    ledgerAccount: extra.ledgerAccount || row.ledger_code || '',
    status: extra.status || 'open',
  }
}

const expenseToDB = (item, orgId, userId) => {
  const amountIncl = Number(item.amount ?? item.amountIncl ?? item.total ?? 0) || 0
  const btwAmount = item.btwAmount ?? null
  const extra = packExtra(item, EXPENSE_KEYS)
  delete extra.dateMissing
  return {
    id: item.id, org_id: orgId, entity_id: item.entityId || null,
    description: item.description || item.vendor || '', vendor: item.vendor || null,
    date: item.date || todayStr(),
    amount_incl: amountIncl,
    btw_rate: item.btwRate ?? 21, btw_amount: btwAmount,
    amount_excl: btwAmount !== null ? +(amountIncl - Number(btwAmount)).toFixed(2) : (item.amountExcl ?? null),
    category: item.category || null,
    ledger_code: item.ledgerAccount || item.ledgerCode || null,
    currency: item.currency || 'EUR',
    // Storage-pad van de bon ook in de kolom, zodat hij buiten de app terug te vinden is
    receipt_url: item.receiptUrl || item.receiptPath || null, receipt_name: item.receiptName || item.attachmentName || null,
    notes: item.notes || null, created_by: userId || null,
    extra: { ...extra, status: item.status || 'open', dateMissing: !item.date },
  }
}

// localStorage (±5 MB) kan geen base64-bonnen bevatten: grote image/attachment-velden laten we
// in de cache weg (de server heeft ze nog) en markeren we met receiptStripped. Een trigger in
// migration v8 zet ze terug als zo'n ingekort record toch ooit gesynct wordt.
// Zonder cloud is localStorage de enige opslag, dan strippen we niets.
const CACHE_MAX_FIELD = 20000
const cacheValue = (key, val, cloudEnabled) => {
  if (key !== 'expenses' || !cloudEnabled || !Array.isArray(val)) return val
  return val.map(e => {
    if (!e) return e
    const big = ['image', 'attachment'].filter(f => typeof e[f] === 'string' && e[f].length > CACHE_MAX_FIELD)
    if (!big.length) return e
    const copy = { ...e }
    big.forEach(f => { delete copy[f] })
    copy.receiptStripped = [...new Set([...(e.receiptStripped || []), ...big])]
    return copy
  })
}

const entityFromDB = (row) => ({
  ...(row.extra || {}), id: row.id, orgId: row.org_id, name: row.name,
  jurisdiction: row.jurisdiction, currency: row.currency,
  invoicePrefix: row.invoice_prefix, nextInvoiceNumber: row.next_invoice_number,
  paymentTerms: row.payment_terms, defaultBtwRate: row.default_btw_rate,
  isActive: row.is_active, createdAt: row.created_at,
})

const ENTITY_KEYS = new Set(['id', 'orgId', 'name', 'jurisdiction', 'currency', 'invoicePrefix', 'nextInvoiceNumber', 'paymentTerms', 'defaultBtwRate', 'isActive', 'createdAt'])

const entityToDB = (item, orgId) => ({
  id: item.id, org_id: orgId, name: item.name || '',
  jurisdiction: item.jurisdiction || 'NL', currency: item.currency || 'EUR',
  invoice_prefix: item.invoicePrefix ?? `${new Date().getFullYear()}-`,
  next_invoice_number: item.nextInvoiceNumber || 1,
  payment_terms: item.paymentTerms || 14,
  default_btw_rate: item.defaultBtwRate ?? 21,
  is_active: item.isActive !== false,
  extra: packExtra(item, ENTITY_KEYS),
})

// Vaste activa: BoekhoudenView werkt met snake_case velden (purchase_value, is_active, …).
// De mapper levert dat formaat terug, zodat waarden na een reload niet meer op 0 springen.
const ASSET_KEYS = new Set(['id', 'entityId', 'name', 'category', 'purchase_date', 'purchaseDate', 'purchase_value', 'purchaseValue', 'residual_value', 'residualValue', 'depreciation_years', 'depreciationYears', 'is_active', 'isActive', 'notes', 'createdAt'])

const boekAssetFromDB = (row) => ({
  ...(row.extra || {}), id: row.id, entityId: row.entity_id, name: row.name,
  category: row.category, purchase_date: row.purchase_date,
  purchase_value: row.purchase_value, residual_value: row.residual_value,
  depreciation_years: row.depreciation_years, is_active: row.is_active,
  notes: row.notes, createdAt: row.created_at,
})

const numOrNull = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v)

const boekAssetToDB = (item, orgId) => ({
  id: item.id, org_id: orgId, entity_id: item.entityId || null,
  name: item.name || '', category: item.category || null,
  purchase_date: item.purchase_date || item.purchaseDate || null,
  purchase_value: numOrNull(item.purchase_value ?? item.purchaseValue),
  residual_value: numOrNull(item.residual_value ?? item.residualValue) ?? 0,
  depreciation_years: parseInt(item.depreciation_years ?? item.depreciationYears) || 5,
  is_active: (item.is_active ?? item.isActive) !== false,
  notes: item.notes || null, extra: packExtra(item, ASSET_KEYS),
})

// Journaalposten: handmatige memoriaalboekingen hebben `type: 'credit'|'debet'`,
// bank-boekingen `isDebit`. Beide blijven nu behouden (type via extra).
const ENTRY_KEYS = new Set(['id', 'entityId', 'date', 'category', 'description', 'amount', 'isDebit', 'ledgerCode', 'reference', 'createdAt'])

const boekEntryFromDB = (row) => ({
  ...(row.extra || {}), id: row.id, entityId: row.entity_id, date: row.date,
  category: row.category, description: row.description, amount: row.amount,
  isDebit: row.is_debit, ledgerCode: row.ledger_code, reference: row.reference,
  createdAt: row.created_at,
})

const boekEntryToDB = (item, orgId) => ({
  id: item.id, org_id: orgId, entity_id: item.entityId || null,
  date: item.date || todayStr(),
  category: item.category || null, description: item.description || null,
  amount: numOrNull(item.amount),
  is_debit: item.type ? item.type === 'debet' : item.isDebit !== false,
  ledger_code: item.ledgerCode || null, reference: item.reference || null,
  extra: packExtra(item, ENTRY_KEYS),
})

const BANK_KEYS = new Set(['id', 'entityId', 'externalId', 'account', 'date', 'description', 'counterparty', 'reference', 'type', 'amount', 'currency', 'origAmount', 'origCurrency', 'fee', 'balance', 'status', 'matchedInvoiceId', 'matchedExpenseId', 'boekEntryId', 'aiLedgerCode', 'aiCategory', 'aiConfidence', 'aiNote', 'notes', 'createdAt'])

const bankTxFromDB = (row) => ({
  ...(row.extra || {}), id: row.id, entityId: row.entity_id, externalId: row.external_id,
  account: row.account, date: row.date, description: row.description,
  counterparty: row.counterparty, reference: row.reference, type: row.type,
  amount: Number(row.amount), currency: row.currency,
  origAmount: row.orig_amount, origCurrency: row.orig_currency,
  fee: row.fee, balance: row.balance, status: row.status,
  matchedInvoiceId: row.matched_invoice_id, matchedExpenseId: row.matched_expense_id,
  boekEntryId: row.boek_entry_id,
  aiLedgerCode: row.ai_ledger_code, aiCategory: row.ai_category,
  aiConfidence: row.ai_confidence, aiNote: row.ai_note,
  notes: row.notes, createdAt: row.created_at,
})

const bankTxToDB = (item, orgId) => ({
  id: item.id, org_id: orgId, entity_id: item.entityId || null,
  external_id: item.externalId || null, account: item.account || null,
  date: item.date || todayStr(),
  description: item.description || null, counterparty: item.counterparty || null,
  reference: item.reference || null, type: item.type || null,
  amount: item.amount ?? 0, currency: item.currency || 'EUR',
  orig_amount: item.origAmount ?? null, orig_currency: item.origCurrency || null,
  fee: item.fee ?? 0, balance: item.balance ?? null,
  status: item.status || 'unmatched',
  matched_invoice_id: item.matchedInvoiceId || null,
  matched_expense_id: item.matchedExpenseId || null,
  boek_entry_id: item.boekEntryId || null,
  ai_ledger_code: item.aiLedgerCode || null, ai_category: item.aiCategory || null,
  ai_confidence: item.aiConfidence ?? null, ai_note: item.aiNote || null,
  notes: item.notes || null, extra: packExtra(item, BANK_KEYS),
})

// Mapping: storage key → Supabase tabel + modus
const TABLE_CONFIG = {
  settings: {
    table: 'org_settings', mode: 'single', idField: 'org_id',
    fromDB: (row) => {
      const { org_id, updated_at, extra, ...rest } = row
      const snake2camel = (s) => s.replace(/_([a-z])/g, (_,c) => c.toUpperCase())
      const out = {}
      Object.entries(rest).forEach(([k,v]) => { if (v !== null) out[snake2camel(k)] = v })
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
  clients: { table: 'clients', mode: 'array', fromDB: clientFromDB, toDB: clientToDB, select: '*' },
  invoices: {
    table: 'invoices', mode: 'array',
    fromDB: invoiceFromDB, toDB: invoiceToDB,
    select: '*, invoice_items(*), invoice_reminders(*)',
    childTable: 'invoice_items', childKey: 'invoice_id',
    childToDB: (items, parentId) => itemsToDB(items, parentId, 'invoice_id'),
  },
  expenses: { table: 'expenses', mode: 'array', fromDB: expenseFromDB, toDB: expenseToDB, select: '*' },
  entities: { table: 'entities', mode: 'array', fromDB: entityFromDB, toDB: entityToDB, select: '*' },
  quotes: {
    table: 'quotes', mode: 'array',
    fromDB: quoteFromDB, toDB: quoteToDB,
    select: '*, quote_items(*)',
    childTable: 'quote_items', childKey: 'quote_id',
    childToDB: (items, parentId) => itemsToDB(items, parentId, 'quote_id'),
  },
  horizonData: { table: 'horizon_scenarios', mode: 'horizon' },
  boek_assets: { table: 'boek_assets', mode: 'array', fromDB: boekAssetFromDB, toDB: boekAssetToDB, select: '*' },
  boek_entries: { table: 'boek_entries', mode: 'array', fromDB: boekEntryFromDB, toDB: boekEntryToDB, select: '*' },
  bank_transactions: { table: 'bank_transactions', mode: 'array', fromDB: bankTxFromDB, toDB: bankTxToDB, select: '*' },
  purchase_invoices: { table: 'purchase_invoices', mode: 'array', fromDB: pinvFromDB, toDB: pinvToDB, select: '*' },
  userApiKeys: {
    table: 'user_settings', mode: 'user_single',
    // Alleen de hash van de import-token staat in de database; de token zelf wordt één keer getoond.
    fromDB: (row) => ({ ...(row.data || {}), importTokenActive: !!row.api_token_hash }),
  },
}

// ── Sync-status (globaal) ─────────────────────────────────────
// Eén kleine store zodat de UI kan tonen "Opslaan…", "Opgeslagen" of een sync-fout,
// i.p.v. dat fouten stil in de console verdwijnen.
const syncStore = { pending: 0, error: null, lastSyncedAt: null, listeners: new Set() }
const emitSync = () => syncStore.listeners.forEach(fn => fn({ pending: syncStore.pending, error: syncStore.error, lastSyncedAt: syncStore.lastSyncedAt }))

export const useSyncStatus = () => {
  const [state, setState] = useState({ pending: syncStore.pending, error: syncStore.error, lastSyncedAt: syncStore.lastSyncedAt })
  useEffect(() => {
    syncStore.listeners.add(setState)
    return () => { syncStore.listeners.delete(setState) }
  }, [])
  return state
}

const check = (res, what) => {
  if (res?.error) throw new Error(`${what}: ${res.error.message}`)
  return res?.data
}

const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const stableStringify = (v) => JSON.stringify(v ?? null)

// Cloud-synced storage hook
// — Elke sleutel heeft zijn eigen Supabase-tabel via TABLE_CONFIG
// — orgId: uit OrgDataContext (accountant die in een org kijkt) OF uit profile.organization_id
// — Saves zijn optimistisch (UI direct bijgewerkt) en worden per sleutel in een wachtrij
//   gesynchroniseerd. Alleen gewijzigde/verwijderde records gaan naar Supabase.
export const useCloudStorage = (key, defaultValue) => {
  const { user, profile } = useContext(AuthContext) || {}
  const { orgId: ctxOrgId, readOnly } = useContext(OrgDataContext) || {}

  const orgId = ctxOrgId || profile?.organization_id || null
  const storageKey = orgId ? `org_${orgId}_${key}` : user ? `${user.id}_${key}` : key
  const cfg = TABLE_CONFIG[key]
  const cloudEnabled = isSupabaseConfigured && cfg && (orgId || cfg.mode === 'user_single')

  const [value, setValue] = useState(defaultValue)
  const [loaded, setLoaded] = useState(false)
  const valueRef = useRef(defaultValue)
  // Laatst bekende server-staat: Map(id → json) voor arrays, json-string voor single/horizon.
  // null = onbekend (server nog niet geladen) → dan wordt er nooit iets verwijderd.
  const baselineRef = useRef(null)
  const queueRef = useRef(Promise.resolve())
  const dirtyRef = useRef(false)
  const lastFetchRef = useRef(0)

  const setBaselineFrom = (val) => {
    if (!cfg) return
    if (cfg.mode === 'array') {
      baselineRef.current = new Map((Array.isArray(val) ? val : []).filter(i => i?.id).map(i => [i.id, stableStringify(i)]))
    } else {
      baselineRef.current = stableStringify(val)
    }
  }

  const applyValue = (val) => {
    valueRef.current = val
    setValue(val)
    try { localStorage.setItem(storageKey, JSON.stringify(cacheValue(key, val, cloudEnabled))) } catch {}
  }

  const fetchRemote = async () => {
    if (!cloudEnabled) return undefined
    if (cfg.mode === 'single') {
      const row = check(await supabase.from(cfg.table).select('*').eq('org_id', orgId).maybeSingle(), `${key} laden`)
      return row ? cfg.fromDB(row) : undefined
    }
    if (cfg.mode === 'array') {
      const rows = check(await supabase.from(cfg.table).select(cfg.select || '*').eq('org_id', orgId).order('created_at', { ascending: true }), `${key} laden`)
      return (rows || []).map(r => cfg.fromDB(r))
    }
    if (cfg.mode === 'horizon') {
      const rows = check(await supabase.from(cfg.table).select('*').eq('org_id', orgId), `${key} laden`)
      if (!rows || rows.length === 0) return undefined
      const obj = {}
      rows.forEach(r => { obj[r.entity_id || 'default'] = r.data })
      return obj
    }
    if (cfg.mode === 'user_single') {
      if (!user?.id) return undefined
      const row = check(await supabase.from(cfg.table).select('*').eq('user_id', user.id).maybeSingle(), `${key} laden`)
      return row ? cfg.fromDB(row) : undefined
    }
    return undefined
  }

  useEffect(() => {
    let cancelled = false
    baselineRef.current = null
    dirtyRef.current = false
    const load = async () => {
      // Stap 1: laad meteen uit localStorage zodat UI direct zichtbaar is
      try {
        const cached = localStorage.getItem(storageKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          valueRef.current = parsed
          setValue(parsed)
          setLoaded(true)
        }
      } catch {}

      // Stap 2: verse data van Supabase. Als de gebruiker intussen al iets heeft gewijzigd,
      // overschrijven we die wijziging niet — dan wordt alleen de baseline gezet.
      if (cloudEnabled) {
        try {
          const remote = await fetchRemote()
          if (cancelled) return
          lastFetchRef.current = Date.now()
          if (remote !== undefined) {
            setBaselineFrom(remote)
            if (!dirtyRef.current) applyValue(remote)
          } else {
            setBaselineFrom(cfg.mode === 'array' ? [] : null)
          }
        } catch (e) {
          console.warn('Supabase load failed:', e.message)
        }
      }
      if (!cancelled) setLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [user?.id, orgId, key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bij terugkeren naar het tabblad: verse data ophalen (andere device/tab kan iets gewijzigd
  // hebben), maar alleen als er hier niets openstaat om te syncen.
  useEffect(() => {
    if (!cloudEnabled) return
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return
      if (dirtyRef.current || Date.now() - lastFetchRef.current < 30000) return
      try {
        const remote = await fetchRemote()
        lastFetchRef.current = Date.now()
        if (remote !== undefined && !dirtyRef.current) {
          setBaselineFrom(remote)
          applyValue(remote)
        }
      } catch (e) {
        console.warn('Supabase refresh failed:', e.message)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [cloudEnabled, orgId, user?.id, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const syncArray = async (arr) => {
    const baseline = baselineRef.current
    const items = (Array.isArray(arr) ? arr : []).filter(i => i?.id)
    const changed = items.filter(i => !baseline || baseline.get(i.id) !== stableStringify(i))
    const currentIds = new Set(items.map(i => i.id))
    const removed = baseline ? [...baseline.keys()].filter(id => !currentIds.has(id)) : []

    for (const part of chunk(changed, 200)) {
      const rows = part.map(item => cfg.toDB(item, orgId, user?.id))
      check(await supabase.from(cfg.table).upsert(rows, { onConflict: 'id' }), `${key} opslaan`)
      if (cfg.childTable && cfg.childToDB) {
        const ids = part.map(i => i.id)
        check(await supabase.from(cfg.childTable).delete().in(cfg.childKey, ids), `${key} regels vervangen`)
        const childRows = part.flatMap(i => cfg.childToDB(i.items || [], i.id))
        if (childRows.length > 0) check(await supabase.from(cfg.childTable).insert(childRows), `${key} regels opslaan`)
      }
      part.forEach(i => baseline?.set(i.id, stableStringify(i)))
    }
    for (const part of chunk(removed, 200)) {
      check(await supabase.from(cfg.table).delete().eq('org_id', orgId).in('id', part), `${key} verwijderen`)
      part.forEach(id => baseline.delete(id))
    }
    if (!baseline) setBaselineFrom(items)
  }

  const syncOther = async (resolved) => {
    const json = stableStringify(resolved)
    if (baselineRef.current === json) return
    if (cfg.mode === 'single') {
      check(await supabase.from(cfg.table).upsert(cfg.toDB(resolved, orgId), { onConflict: 'org_id' }), `${key} opslaan`)
    } else if (cfg.mode === 'horizon') {
      for (const [entityId, data] of Object.entries(resolved || {})) {
        const eId = entityId === 'default' ? null : entityId
        let q = supabase.from(cfg.table).select('id').eq('org_id', orgId)
        q = eId ? q.eq('entity_id', eId) : q.is('entity_id', null)
        const existing = check(await q.limit(1).maybeSingle(), `${key} zoeken`)
        if (existing?.id) {
          check(await supabase.from(cfg.table).update({ data, updated_at: new Date().toISOString() }).eq('id', existing.id), `${key} opslaan`)
        } else {
          check(await supabase.from(cfg.table).insert({ org_id: orgId, entity_id: eId, data, name: 'Horizon', year: new Date().getFullYear() }), `${key} opslaan`)
        }
      }
    } else if (cfg.mode === 'user_single') {
      if (!user?.id) return
      check(await supabase.from(cfg.table).upsert(
        { user_id: user.id, org_id: orgId || null, data: resolved, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      ), `${key} opslaan`)
    }
    baselineRef.current = json
  }

  const save = (newValue) => {
    if (readOnly) return Promise.resolve()
    const resolved = typeof newValue === 'function' ? newValue(valueRef.current) : newValue
    applyValue(resolved)
    if (!cloudEnabled) return Promise.resolve()

    dirtyRef.current = true
    syncStore.pending += 1
    emitSync()
    // Elke sync draait na de vorige (per sleutel) en synct de NIEUWSTE waarde,
    // zodat snel achter elkaar klikken nooit door elkaar heen schrijft.
    let failed = false
    const run = queueRef.current.then(async () => {
      try {
        const latest = valueRef.current
        if (cfg.mode === 'array') await syncArray(latest)
        else await syncOther(latest)
        syncStore.error = null
        syncStore.lastSyncedAt = Date.now()
      } catch (e) {
        console.warn('Supabase sync failed:', e.message)
        syncStore.error = e.message
        failed = true
      } finally {
        syncStore.pending -= 1
        // Bij een fout blijft de baseline staan, dus de volgende save probeert het opnieuw.
        if (queueRef.current === run && !failed) dirtyRef.current = false
        emitSync()
      }
    })
    queueRef.current = run
    // Niet wachten op het netwerk: de UI is al bijgewerkt, de sync loopt op de achtergrond.
    return Promise.resolve()
  }

  // Forceer een verse load van de server (gebruikt door Data-controle na herstel)
  const reload = async () => {
    if (!cloudEnabled) return
    await queueRef.current
    const remote = await fetchRemote()
    lastFetchRef.current = Date.now()
    if (remote !== undefined) { setBaselineFrom(remote); applyValue(remote) }
  }

  return [value, save, loaded, reload]
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
      // Skip TOKEN_REFRESHED to avoid unnecessary re-renders (Supabase fires this on tab focus).
      // The access token is refreshed internally; user identity does not change.
      if (event === 'TOKEN_REFRESHED') return
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

  // Registreren maakt alleen een account aan. Aansluiten bij of aanmaken van een
  // organisatie gebeurt ná inloggen in de SetupWizard (via RPC's die de server controleert).
  const signUp = async (email, password, fullName) => {
    if (!isSupabaseConfigured) return { error: { message: 'Supabase niet geconfigureerd.' } }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
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
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (error) {
      console.error('[updateProfile] Supabase error:', error.message)
      return { error }
    }
    setProfile(p => ({ ...p, ...updates }))
    return { error: null }
  }

  // RPC-fouten → begrijpelijke Nederlandse melding
  const rpcError = (error, fallback) => {
    const msg = error?.message || ''
    if (/could not find the function|PGRST202/i.test(msg)) {
      return new Error('Deze functie is nog niet beschikbaar op de server (database-migratie v7 ontbreekt).')
    }
    return new Error(msg || fallback)
  }

  // Organisatie aanmaken + jezelf org_owner maken gebeurt atomair op de server.
  const createOrg = async (name) => {
    if (!isSupabaseConfigured || !user) return { error: new Error('Niet geconfigureerd') }
    const { data, error } = await supabase.rpc('create_organization', { p_name: (name || '').trim() })
    if (error) return { error: rpcError(error, 'Organisatie aanmaken is mislukt.') }
    const org = Array.isArray(data) ? data[0] : data
    if (!org?.id) return { error: new Error('Organisatie aanmaken is mislukt.') }
    setProfile(p => ({ ...p, organization_id: org.id, role: p?.role === 'platform_admin' ? p.role : 'org_owner' }))
    setOrganization({ id: org.id, name: org.name, plan: org.plan })
    return { data: org, error: null }
  }

  // Aansluiten via uitnodigingscode (server zet org + rol employee/meekijk)
  const joinOrgByInvite = async (code) => {
    if (!isSupabaseConfigured || !user) return { error: new Error('Niet geconfigureerd') }
    const { data: orgId, error } = await supabase.rpc('join_org_by_invite', { p_code: (code || '').trim() })
    if (error) return { error: rpcError(error, 'Aansluiten is mislukt.') }
    await fetchProfile(user.id)
    return { data: orgId, error: null }
  }

  const updateOrganization = async (updates) => {
    if (!isSupabaseConfigured || !organization?.id) return
    const { error } = await supabase.from('organizations').update(updates).eq('id', organization.id)
    if (error) {
      console.error('[updateOrganization] Supabase error:', error.message)
      return { error }
    }
    setOrganization(o => ({ ...o, ...updates }))
    return { error: null }
  }

  const isPlatformAdmin = profile?.role === 'platform_admin'
  const isOrgOwner = profile?.role === 'org_owner' || isPlatformAdmin
  const isAccountant = profile?.role === 'accountant' || isPlatformAdmin
  const isEmployee = profile?.role === 'employee'
  const isReadOnly = profile?.access_type === 'meekijk'

  return (
    <AuthContext.Provider value={{
      user, profile, organization, loading, profileLoading,
      signIn, signUp, signOut, updateProfile, createOrg, joinOrgByInvite, updateOrganization,
      isPlatformAdmin, isOrgOwner, isAccountant, isEmployee, isReadOnly,
      isConfigured: isSupabaseConfigured,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
