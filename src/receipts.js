// Bonnen/bijlagen in Supabase Storage (privé bucket `receipts`, pad <org_id>/<expense_id>/...).
// De kostenpost bewaart alleen het pad; tonen gaat via een tijdelijke signed URL.
import { useContext } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { useAuth, OrgDataContext } from './AuthProvider'

const BUCKET = 'receipts'
const SIGNED_TTL = 3600 // seconden geldig bij Supabase
const CACHE_MS = 50 * 60 * 1000 // iets korter dan de TTL, zodat een gecachte URL nooit net verlopen is
const urlCache = new Map() // path → { url, at }

// Org-id waaronder bonnen worden opgeslagen (accountant die in een org kijkt → die org)
export const useReceiptOrgId = () => {
  const { profile } = useAuth()
  const { orgId } = useContext(OrgDataContext) || {}
  return orgId || profile?.organization_id || null
}

export const storageAvailable = (orgId) => !!(isSupabaseConfigured && supabase && orgId)

export const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:')

export const dataUrlToBlob = (dataUrl) => {
  const [head, b64] = dataUrl.split(',')
  const type = head.match(/data:([^;]+)/)?.[1] || 'application/octet-stream'
  const bin = atob(b64 || '')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => resolve(e.target.result)
  reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen'))
  reader.readAsDataURL(blob)
})

const extFor = (type) => ({
  'application/pdf': 'pdf', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/heic': 'heic', 'image/heif': 'heif',
}[type] || 'jpg')

// Upload een bon; geeft het storage-pad terug. Gooit een fout als het niet lukt
// (de aanroeper valt dan terug op base64 in de kostenpost).
export const uploadReceipt = async (orgId, expenseId, blobOrDataUrl, contentType, kind = 'bon') => {
  if (!storageAvailable(orgId)) throw new Error('Supabase Storage niet beschikbaar')
  const blob = isDataUrl(blobOrDataUrl) ? dataUrlToBlob(blobOrDataUrl) : blobOrDataUrl
  const type = contentType || blob.type || 'image/jpeg'
  const path = `${orgId}/${expenseId}/${kind}-${Date.now().toString(36)}.${extFor(type)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: true, cacheControl: '3600' })
  if (error) throw new Error(error.message || 'Upload mislukt')
  return path
}

// Tijdelijke URL om een bon te tonen/openen (in geheugen gecachet)
export const receiptUrl = async (path) => {
  if (!path || !supabase) return null
  const hit = urlCache.get(path)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL)
  if (error) throw new Error(error.message || 'Bon kon niet worden geladen')
  urlCache.set(path, { url: data.signedUrl, at: Date.now() })
  return data.signedUrl
}

// Volledige bon als data-URL (voor de AI-scan)
export const downloadReceiptDataUrl = async (path) => {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw new Error(error.message || 'Bon kon niet worden gedownload')
  return blobToDataUrl(data)
}

// Opruimen bij verwijderen van een kostenpost; fouten zijn niet erg (hooguit een wees-bestand)
export const removeReceipts = async (paths) => {
  const list = (paths || []).filter(Boolean)
  if (!list.length || !supabase) return
  list.forEach(p => urlCache.delete(p))
  try { await supabase.storage.from(BUCKET).remove(list) } catch { /* negeren */ }
}
