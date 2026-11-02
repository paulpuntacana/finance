// ============================================================================
// Finance-kern: één plek voor alle rekenregels, zodat Dashboard, Winst & Verlies,
// BTW-aangifte, Grootboek en Data-controle exact hetzelfde rekenen.
// ============================================================================

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Lokale datum (niet UTC — anders krijg je tussen 00:00 en 02:00 de datum van gisteren)
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const yearOf = (iso) => (iso ? Number(String(iso).slice(0, 4)) : null)
export const monthOf = (iso) => (iso ? Number(String(iso).slice(5, 7)) - 1 : null)

// ── Facturen ────────────────────────────────────────────────────────────────

// Netto regelbedrag. Werkt ook voor creditnota's (negatieve prijzen): korting verkleint
// dan het negatieve bedrag in plaats van het naar 0 te klemmen.
export const lineNet = (it) => {
  const base = Number(it.quantity || 0) * Number(it.price || 0)
  let discount = 0
  if (it.discount && Number(it.discount.value) > 0) {
    discount = it.discount.type === 'percent'
      ? Math.abs(base) * (Number(it.discount.value) / 100)
      : Number(it.discount.value)
  }
  if (base >= 0) return { base, discount, net: Math.max(0, base - discount) }
  return { base, discount, net: Math.min(0, base + discount) }
}

export const computeInvoice = (items = []) => {
  let subtotal = 0
  let totalDiscount = 0
  const btwByRate = {}
  const netByRate = {}
  ;(items || []).forEach((it) => {
    const { discount, net } = lineNet(it)
    const rate = Number(it.btwRate || 0)
    subtotal += net
    totalDiscount += discount
    btwByRate[rate] = (btwByRate[rate] || 0) + net * (rate / 100)
    netByRate[rate] = (netByRate[rate] || 0) + net
  })
  const btwTotal = Object.values(btwByRate).reduce((a, b) => a + b, 0)
  return { subtotal, totalDiscount, btwByRate, netByRate, btwTotal, total: subtotal + btwTotal }
}

// Telt mee als omzet: alles wat verstuurd is (factuurstelsel), incl. creditnota's (negatief).
// Concepten en geannuleerde facturen niet.
export const isRevenueInvoice = (inv) => inv && inv.status !== 'draft' && inv.status !== 'cancelled'

export const invoiceDate = (inv) => inv.issueDate || inv.date || null

export const invoicePaidAmount = (inv) => {
  if (inv.status === 'paid') return computeInvoice(inv.items).total
  if (Array.isArray(inv.payments) && inv.payments.length) return inv.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  return Number(inv.paidAmount || 0)
}

export const invoiceOpenAmount = (inv) => {
  if (!isRevenueInvoice(inv) || inv.status === 'credit_note' || inv.status === 'paid') return 0
  return Math.max(0, computeInvoice(inv.items).total - invoicePaidAmount(inv))
}

// ── EU-landen (voor ICP / verlegde BTW) ─────────────────────────────────────
const EU_COUNTRIES = [
  ['AT', 'oostenrijk', 'austria', 'österreich'], ['BE', 'belgië', 'belgie', 'belgium', 'belgique'],
  ['BG', 'bulgarije', 'bulgaria'], ['HR', 'kroatië', 'kroatie', 'croatia'], ['CY', 'cyprus'],
  ['CZ', 'tsjechië', 'tsjechie', 'czech republic', 'czechia'], ['DK', 'denemarken', 'denmark'],
  ['EE', 'estland', 'estonia'], ['FI', 'finland'], ['FR', 'frankrijk', 'france'],
  ['DE', 'duitsland', 'germany', 'deutschland'], ['GR', 'griekenland', 'greece'],
  ['HU', 'hongarije', 'hungary'], ['IE', 'ierland', 'ireland'], ['IT', 'italië', 'italie', 'italy'],
  ['LV', 'letland', 'latvia'], ['LT', 'litouwen', 'lithuania'], ['LU', 'luxemburg', 'luxembourg'],
  ['MT', 'malta'], ['NL', 'nederland', 'netherlands', 'the netherlands', 'holland'],
  ['PL', 'polen', 'poland'], ['PT', 'portugal'], ['RO', 'roemenië', 'roemenie', 'romania'],
  ['SK', 'slowakije', 'slovakia'], ['SI', 'slovenië', 'slovenie', 'slovenia'],
  ['ES', 'spanje', 'spain', 'españa', 'espana'], ['SE', 'zweden', 'sweden'],
]

export const countryCode = (country) => {
  const c = String(country || '').trim().toLowerCase()
  if (!c) return 'NL'
  const hit = EU_COUNTRIES.find(row => row[0].toLowerCase() === c || row.slice(1).includes(c))
  return hit ? hit[0] : 'NON_EU'
}
export const isEUCountry = (country) => countryCode(country) !== 'NON_EU'

// ── Kosten / bonnen ─────────────────────────────────────────────────────────
// BTW-behandeling per kostenpost:
//   standard        Nederlandse BTW op de factuur → voorbelasting (5b)
//   reverse_eu      Leverancier in andere EU-lidstaat, BTW verlegd → 4b + 5b
//   reverse_non_eu  Dienst van buiten de EU (Vercel, Anthropic, Make, …) → 4a + 5b
//   none            Geen BTW (vrijgesteld, bankkosten, verzekering, buitenland zonder verlegging)
export const VAT_TREATMENTS = [
  { id: 'standard', label: 'NL BTW (aftrekbaar)', short: 'NL BTW' },
  { id: 'reverse_non_eu', label: 'Verlegd — dienst van buiten EU (4a)', short: 'Verlegd 4a' },
  { id: 'reverse_eu', label: 'Verlegd — leverancier binnen EU (4b)', short: 'Verlegd 4b' },
  { id: 'none', label: 'Geen BTW', short: 'Geen BTW' },
]

// Bekende leveranciers → standaard-behandeling. Bedoeld als suggestie, altijd aanpasbaar.
const VENDOR_VAT_RULES = [
  { match: /vercel/i, treatment: 'reverse_non_eu' },
  { match: /anthropic|claude\.ai/i, treatment: 'reverse_non_eu' },
  { match: /make\.com|www\.make|celonis/i, treatment: 'reverse_eu' },
  { match: /smartlead/i, treatment: 'reverse_non_eu' },
  { match: /openai|chatgpt/i, treatment: 'reverse_eu' },
  { match: /github/i, treatment: 'reverse_non_eu' },
  { match: /supabase/i, treatment: 'reverse_non_eu' },
  { match: /cursor|anysphere/i, treatment: 'reverse_non_eu' },
  { match: /notion/i, treatment: 'reverse_non_eu' },
  { match: /figma/i, treatment: 'reverse_non_eu' },
  { match: /slack/i, treatment: 'reverse_eu' },
  { match: /google|gsuite|workspace/i, treatment: 'reverse_eu' },
  { match: /microsoft|azure|office 365/i, treatment: 'reverse_eu' },
  { match: /apple\.com|itunes/i, treatment: 'reverse_eu' },
  { match: /aws|amazon web services/i, treatment: 'reverse_eu' },
  { match: /linkedin/i, treatment: 'reverse_eu' },
  { match: /meta|facebook/i, treatment: 'reverse_eu' },
  { match: /stripe/i, treatment: 'reverse_eu' },
  { match: /revolut.*(fee|plan|subscription)|bank(kosten| fee)/i, treatment: 'none' },
]

export const suggestVatTreatment = ({ vendor = '', description = '', currency = 'EUR', origCurrency = null } = {}) => {
  const text = `${vendor} ${description}`
  const rule = VENDOR_VAT_RULES.find(r => r.match.test(text))
  if (rule) return rule.treatment
  const cur = (origCurrency || currency || 'EUR').toUpperCase()
  if (cur !== 'EUR') return 'reverse_non_eu'
  return 'standard'
}

// Behandeling van een bestaande kostenpost (oude data heeft nog geen vatTreatment)
export const expenseVatTreatment = (e) => e.vatTreatment || (Number(e.btwAmount || 0) > 0 ? 'standard' : 'none')

export const isCountedExpense = (e) => e && e.status === 'processed'

// Bedrag excl. BTW in basisvaluta. `amount` is altijd incl. eventuele NL BTW.
export const expenseNet = (e) => {
  const amount = Number(e.amount || 0)
  return expenseVatTreatment(e) === 'standard' ? amount - Number(e.btwAmount || 0) : amount
}

// Verlegde BTW: tarief over het netto bedrag (zelf verschuldigd én aftrekbaar)
export const expenseReverseVat = (e) => {
  const t = expenseVatTreatment(e)
  if (t !== 'reverse_eu' && t !== 'reverse_non_eu') return 0
  const rate = Number(e.reverseRate ?? 21)
  return round2(expenseNet(e) * rate / 100)
}

// ── BTW-aangifte (Nederlandse rubrieken) ────────────────────────────────────
export const buildVatReturn = ({ invoices = [], expenses = [], clients = [], start, end }) => {
  const inPeriod = (iso) => {
    if (!iso) return false
    const d = new Date(iso + (String(iso).length === 10 ? 'T12:00:00' : ''))
    return d >= start && d < end
  }
  const r = {
    '1a': { net: 0, tax: 0 }, '1b': { net: 0, tax: 0 }, '1c': { net: 0, tax: 0 },
    '1e': { net: 0, tax: 0 }, '3b': { net: 0, tax: 0 },
    '4a': { net: 0, tax: 0 }, '4b': { net: 0, tax: 0 },
    '5b': { tax: 0 },
  }
  const salesRows = []
  invoices.filter(i => isRevenueInvoice(i) && inPeriod(invoiceDate(i))).forEach(inv => {
    const client = clients.find(c => c.id === inv.clientId)
    const cc = countryCode(client?.country)
    const t = computeInvoice(inv.items)
    Object.entries(t.netByRate).forEach(([rateStr, net]) => {
      const rate = Number(rateStr)
      const tax = t.btwByRate[rateStr] || 0
      let box = '1c'
      if (rate >= 20) box = '1a'
      else if (rate >= 8 && rate < 10) box = '1b'
      else if (rate === 0) box = (cc !== 'NL' && cc !== 'NON_EU') ? '3b' : '1e'
      r[box].net += net
      r[box].tax += tax
    })
    salesRows.push({ inv, client, totals: t, country: cc })
  })

  const purchaseRows = []
  expenses.filter(e => isCountedExpense(e) && inPeriod(e.date)).forEach(e => {
    const treatment = expenseVatTreatment(e)
    const net = expenseNet(e)
    if (treatment === 'standard') {
      r['5b'].tax += Number(e.btwAmount || 0)
    } else if (treatment === 'reverse_non_eu' || treatment === 'reverse_eu') {
      const vat = expenseReverseVat(e)
      const box = treatment === 'reverse_non_eu' ? '4a' : '4b'
      r[box].net += net
      r[box].tax += vat
      r['5b'].tax += vat
    }
    purchaseRows.push({ e, treatment, net, vat: treatment === 'standard' ? Number(e.btwAmount || 0) : expenseReverseVat(e) })
  })

  Object.values(r).forEach(v => { if ('net' in v) v.net = round2(v.net); v.tax = round2(v.tax) })
  const owed = r['1a'].tax + r['1b'].tax + r['1c'].tax + r['4a'].tax + r['4b'].tax
  const deductible = r['5b'].tax
  return { boxes: r, owed: round2(owed), deductible: round2(deductible), saldo: round2(owed - deductible), salesRows, purchaseRows }
}

// ── Winst & verlies ─────────────────────────────────────────────────────────
// Journaalposten: `type` (memoriaal) of `isDebit` (bank). Credit = positief resultaat.
export const entrySignedAmount = (e) => {
  const amt = Number(e.amount || 0)
  if (e.type === 'credit') return amt
  if (e.type === 'debet') return -amt
  return e.isDebit ? -amt : amt
}

export const buildProfitLoss = ({ invoices = [], expenses = [], entries = [], year }) => {
  const revInv = invoices.filter(i => isRevenueInvoice(i) && yearOf(invoiceDate(i)) === year)
  const exp = expenses.filter(e => isCountedExpense(e) && yearOf(e.date) === year)
  const ent = entries.filter(e => yearOf(e.date) === year)
  const revenue = revInv.reduce((s, i) => s + computeInvoice(i.items).subtotal, 0)
  const costs = exp.reduce((s, e) => s + expenseNet(e), 0)
  const memo = ent.reduce((s, e) => s + entrySignedAmount(e), 0)
  return { revInv, exp, ent, revenue: round2(revenue), costs: round2(costs), memo: round2(memo) }
}

// Per maand (0-11): omzet, kosten, resultaat — voor grafieken
export const monthlySeries = ({ invoices = [], expenses = [], year }) => {
  const months = Array.from({ length: 12 }, (_, m) => ({ m, revenue: 0, costs: 0, vat: 0 }))
  invoices.filter(i => isRevenueInvoice(i) && yearOf(invoiceDate(i)) === year).forEach(i => {
    const t = computeInvoice(i.items)
    const m = monthOf(invoiceDate(i))
    months[m].revenue += t.subtotal
    months[m].vat += t.btwTotal
  })
  expenses.filter(e => isCountedExpense(e) && yearOf(e.date) === year).forEach(e => {
    const m = monthOf(e.date)
    if (m === null || isNaN(m)) return
    months[m].costs += expenseNet(e)
    if (expenseVatTreatment(e) === 'standard') months[m].vat -= Number(e.btwAmount || 0)
  })
  return months.map(x => ({ ...x, revenue: round2(x.revenue), costs: round2(x.costs), profit: round2(x.revenue - x.costs), vat: round2(x.vat) }))
}

// ── Data-controle ───────────────────────────────────────────────────────────
// Zoekt alles wat de cijfers kan vervuilen. Elke bevinding heeft een `fix` die
// beschrijft wat het herstel doet; de UI voert die uit.
const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export const findDataIssues = ({ invoices = [], expenses = [], entries = [], transactions = [], clients = [], purchaseInvoices = [] }) => {
  const issues = []

  // 1. Dubbele factuurnummers
  const byNumber = {}
  invoices.forEach(i => {
    if (!i.number) return
    const k = `${i.entityId || ''}|${i.number}`
    ;(byNumber[k] = byNumber[k] || []).push(i)
  })
  Object.values(byNumber).filter(list => list.length > 1).forEach(list => {
    const sameContent = list.every(i => i.clientId === list[0].clientId && Math.abs(computeInvoice(i.items).total - computeInvoice(list[0].items).total) < 0.01)
    issues.push({
      id: `dupnum_${list[0].number}`, type: 'duplicate_invoice_number', severity: 'high',
      title: `Factuurnummer ${list[0].number} komt ${list.length}× voor`,
      detail: sameContent ? 'Zelfde klant en bedrag — waarschijnlijk een dubbele kopie.' : 'Verschillende inhoud — één ervan moet een ander nummer krijgen.',
      invoices: list, sameContent,
    })
  })

  // 2. Exact dubbele facturen met verschillend nummer (zelfde klant, datum en bedrag)
  const byContent = {}
  invoices.filter(isRevenueInvoice).forEach(i => {
    const k = `${i.clientId}|${invoiceDate(i)}|${computeInvoice(i.items).total.toFixed(2)}|${i.status === 'credit_note'}`
    ;(byContent[k] = byContent[k] || []).push(i)
  })
  Object.values(byContent).filter(l => l.length > 1 && new Set(l.map(i => i.number)).size === l.length).forEach(list => {
    const client = clients.find(c => c.id === list[0].clientId)
    issues.push({
      id: `dupcontent_${list.map(i => i.id).join('_')}`, type: 'duplicate_invoice_content', severity: 'medium',
      title: `${list.length} facturen voor ${client?.name || 'onbekende klant'} met zelfde datum en bedrag`,
      detail: `Nummers ${list.map(i => i.number).join(', ')} — controleer of dit echt aparte facturen zijn.`,
      invoices: list,
    })
  })

  // 3. Factuurregels die dubbel lijken (zelfde omschrijving, aantal en prijs direct herhaald)
  invoices.forEach(i => {
    const items = i.items || []
    if (items.length < 2 || items.length % 2 !== 0) return
    const half = items.length / 2
    const sig = (it) => `${normalize(it.description)}|${it.quantity}|${it.price}|${it.btwRate}`
    const repeated = items.slice(0, half).every((it, idx) => sig(it) === sig(items[half + idx]))
    if (repeated) {
      issues.push({
        id: `dupitems_${i.id}`, type: 'duplicated_lines', severity: 'high',
        title: `Factuur ${i.number}: alle regels staan er dubbel in`,
        detail: `Totaal nu ${computeInvoice(items).total.toFixed(2)}, zonder dubbele regels ${computeInvoice(items.slice(0, half)).total.toFixed(2)}.`,
        invoice: i, fixedItems: items.slice(0, half),
      })
    }
  })

  // 4. Omzet dubbel geboekt: bank-journaalpost (credit) naast een factuur van hetzelfde bedrag
  const revenueInvoices = invoices.filter(i => isRevenueInvoice(i) && i.status !== 'credit_note')
  entries.filter(e => !e.type && e.isDebit === false && /^bank:/i.test(e.reference || '')).forEach(e => {
    const amt = Number(e.amount || 0)
    const match = revenueInvoices.find(i => {
      const t = computeInvoice(i.items)
      return Math.abs(t.total - amt) < 0.01 || Math.abs(t.subtotal - amt) < 0.01
    })
    if (match) {
      issues.push({
        id: `duprev_${e.id}`, type: 'double_revenue', severity: 'high',
        title: `Omzet dubbel: bankontvangst ${amt.toFixed(2)} (${e.description || ''}) én factuur ${match.number}`,
        detail: 'De bankontvangst is als losse omzet-journaalpost geboekt terwijl de factuur al als omzet telt. Herstel: journaalpost verwijderen en de banktransactie aan de factuur koppelen (factuur → betaald).',
        entry: e, invoice: match,
      })
    }
  })

  // 5. Kosten van bank-import met 21% BTW bij buitenlandse diensten
  const txByExpense = {}
  transactions.forEach(t => { if (t.matchedExpenseId) txByExpense[t.matchedExpenseId] = t })
  expenses.filter(e => isCountedExpense(e) && e.source === 'bank' && !e.vatTreatment).forEach(e => {
    const tx = txByExpense[e.id]
    const suggestion = suggestVatTreatment({ vendor: e.vendor, description: e.notes, currency: e.currency, origCurrency: tx?.origCurrency })
    const hasVat = Number(e.btwAmount || 0) > 0
    if (hasVat && suggestion !== 'standard') {
      issues.push({
        id: `vat_${e.id}`, type: 'wrong_vat', severity: 'high',
        title: `${e.vendor || 'Kostenpost'} ${e.date}: 21% BTW afgetrokken, maar dit is waarschijnlijk ${VAT_TREATMENTS.find(v => v.id === suggestion)?.short}`,
        detail: `Automatisch aangemaakt vanuit Bank (AI-suggestie). Er is € ${Number(e.btwAmount).toFixed(2)} voorbelasting geclaimd zonder Nederlandse BTW-factuur.`,
        expense: e, suggestion,
      })
    } else if (hasVat) {
      issues.push({
        id: `vatcheck_${e.id}`, type: 'unverified_vat', severity: 'low',
        title: `${e.vendor || 'Kostenpost'} ${e.date}: BTW geschat vanuit bank, geen factuur`,
        detail: 'Voorbelasting mag je alleen aftrekken met een geldige factuur. Controleer of het BTW-bedrag klopt.',
        expense: e, suggestion,
      })
    }
  })

  // 6. Dubbele kosten (zelfde bedrag, leverancier lijkt gelijk, binnen 3 dagen)
  const counted = expenses.filter(isCountedExpense)
  const seenPairs = new Set()
  counted.forEach((a, ai) => {
    counted.slice(ai + 1).forEach(b => {
      if (Math.abs(Number(a.amount || 0) - Number(b.amount || 0)) > 0.01 || !a.date || !b.date) return
      const days = Math.abs(new Date(a.date) - new Date(b.date)) / 86400000
      if (days > 3) return
      const va = normalize(a.vendor), vb = normalize(b.vendor)
      if (!va || !vb || !(va.includes(vb) || vb.includes(va) || va.slice(0, 5) === vb.slice(0, 5))) return
      const key = [a.id, b.id].sort().join('|')
      if (seenPairs.has(key)) return
      seenPairs.add(key)
      issues.push({
        id: `dupexp_${key}`, type: 'duplicate_expense', severity: 'medium',
        title: `Mogelijk dubbele kostenpost: ${a.vendor} € ${Number(a.amount).toFixed(2)}`,
        detail: `${a.date} (${a.source || 'handmatig'}) en ${b.date} (${b.source || 'handmatig'}).`,
        expenses: [a, b],
      })
    })
  })

  // 7. Banktransacties gekoppeld aan iets dat niet meer bestaat
  const invIds = new Set(invoices.map(i => i.id))
  const expIds = new Set(expenses.map(e => e.id))
  const entIds = new Set(entries.map(e => e.id))
  transactions.filter(t => t.status === 'matched').forEach(t => {
    const broken = (t.matchedInvoiceId && !invIds.has(t.matchedInvoiceId)) ||
      (t.matchedExpenseId && !expIds.has(t.matchedExpenseId)) ||
      (t.boekEntryId && !entIds.has(t.boekEntryId))
    if (broken) {
      issues.push({
        id: `orphan_${t.id}`, type: 'orphan_tx', severity: 'low',
        title: `Banktransactie ${t.date} ${t.counterparty || t.description}: koppeling verwijst naar verwijderd item`,
        detail: 'Zet terug naar "te verwerken".', tx: t,
      })
    }
  })

  // 8. Betaalde facturen zonder betaaldatum / verstuurde zonder nummer
  invoices.filter(i => isRevenueInvoice(i) && !i.number).forEach(i => {
    issues.push({ id: `nonum_${i.id}`, type: 'missing_number', severity: 'medium', title: `Verstuurde factuur zonder nummer (${invoiceDate(i)})`, detail: 'Geef deze factuur een nummer uit de reeks.', invoice: i })
  })

  // 9. Inkoopfacturen (o.a. via API-import) die nog niet als kostenpost geboekt zijn → tellen niet mee
  //    in W&V en BTW. Bestaat er al een bon met hetzelfde bedrag, dan koppelen i.p.v. dubbel boeken.
  const linkedPinv = new Set(expenses.map(e => e.purchaseInvoiceId).filter(Boolean))
  purchaseInvoices.filter(p => !p.expenseId && !linkedPinv.has(p.id)).forEach(p => {
    const total = Number(p.totalAmount ?? (Number(p.amount || 0) + Number(p.btwAmount || 0)))
    const match = expenses.find(e => !e.purchaseInvoiceId && Math.abs(Number(e.amount || 0) - total) < 0.01 && e.date && p.date &&
      Math.abs(new Date(e.date) - new Date(p.date)) / 86400000 <= 10)
    issues.push({
      id: `pinv_${p.id}`, type: 'unbooked_purchase', severity: 'medium',
      title: `Inkoopfactuur ${p.supplier}${p.invoiceNumber ? ' ' + p.invoiceNumber : ''} (${p.date || 'geen datum'}) telt nog niet mee`,
      detail: match
        ? `Er is al een kostenpost ${match.vendor} € ${Number(match.amount).toFixed(2)} op ${match.date} — herstel koppelt ze (niets dubbel).`
        : `Herstel boekt hem als kostenpost (${(p.currency || 'EUR') === 'EUR' ? 'direct verwerkt' : 'open, want ' + p.currency + ' moet nog naar EUR'}).`,
      pinv: p, match,
    })
  })

  const order = { high: 0, medium: 1, low: 2 }
  return issues.sort((a, b) => order[a.severity] - order[b.severity])
}
