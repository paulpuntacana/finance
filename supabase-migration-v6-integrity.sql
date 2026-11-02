-- ============================================================
-- DHS Finance — Migration v6: data-integriteit + herstel (2 nov 2026)
-- Voer uit in: Supabase → project "Den Hartogh Solutions" → SQL Editor → Run
-- Back-up van alle betrokken tabellen staat in schema backup_20261102.
-- Alles draait in één transactie: lukt één stap niet, dan verandert er niets.
-- ============================================================
begin;

-- ── 1. Dubbele factuur-/offerteregels opruimen en voortaan blokkeren ──────────
delete from public.invoice_items a using public.invoice_items b
 where a.invoice_id = b.invoice_id and a.sort_order = b.sort_order and a.ctid > b.ctid;
delete from public.quote_items a using public.quote_items b
 where a.quote_id = b.quote_id and a.sort_order = b.sort_order and a.ctid > b.ctid;
create unique index if not exists idx_invoice_items_unique_pos on public.invoice_items (invoice_id, sort_order);
create unique index if not exists idx_quote_items_unique_pos on public.quote_items (quote_id, sort_order);

-- ── 2. Dubbele factuurnummers: intern A, B, C… erachter (op factuurdatum) ─────
--    2026-0011 → 0011A (19 aug), 0011B (2 okt), 0011C (2 nov)
--    2026-0012 → 0012A (1 sep),  0012B (12 okt), 0012C (2 nov)
--    Het nummer zoals naar de klant verstuurd blijft bewaard (extra.numberAsSent)
--    en staat ook zo op de PDF als je hem opnieuw downloadt.
with dup as (
  select id, number,
         row_number() over (partition by org_id, coalesce(entity_id,''), number order by issue_date, created_at) as rn,
         count(*) over (partition by org_id, coalesce(entity_id,''), number) as n
  from public.invoices where number <> ''
)
update public.invoices i
   set number = dup.number || chr(64 + dup.rn::int),
       extra = (coalesce(i.extra, '{}'::jsonb) - 'invoiceNumber') || jsonb_build_object('numberAsSent', dup.number)
  from dup where dup.id = i.id and dup.n > 1;

create unique index if not exists idx_invoices_unique_number
  on public.invoices (org_id, coalesce(entity_id, ''), number)
  where number is not null and number <> '';

-- ── 3. Bank-bonnen: onterechte 21% BTW eraf, juiste BTW-behandeling erop ──────
--    30 bonnen uit "Accepteer AI-suggesties" kregen 21% voorbelasting (totaal € 119,59),
--    terwijl Anthropic, Smartlead, Apollo, Supabase, Make, Google, STRATO enz. geen
--    Nederlandse BTW rekenen. Ook stond je eigen naam als leverancier.
with fix as (
  select e.id, t.description as bank_desc,
    case
      when t.description ilike '%revolut%' then 'none'
      when t.description ilike any (array['%make.com%', '%google%', '%strato%', '%viber%']) then 'reverse_eu'
      else 'reverse_non_eu'
    end as treatment
  from public.expenses e
  join public.bank_transactions t on t.matched_expense_id = e.id
  where e.extra->>'source' = 'bank' and e.extra->>'vatTreatment' is null
)
update public.expenses e
   set btw_rate = 0, btw_amount = 0, amount_excl = e.amount_incl,
       vendor = case when e.vendor in ('Paul Den Hartogh', 'Den Hartogh Solutions') then fix.bank_desc else e.vendor end,
       description = case when e.vendor in ('Paul Den Hartogh', 'Den Hartogh Solutions') then fix.bank_desc else e.description end,
       extra = coalesce(e.extra, '{}'::jsonb) || jsonb_build_object('vatTreatment', fix.treatment, 'vatEstimated', false, 'bankFixed20261102', true)
  from fix where fix.id = e.id;

-- Handmatig geüploade bonnen met echte NL BTW (MediaMarkt) → expliciet 'standard'
update public.expenses
   set extra = coalesce(extra, '{}'::jsonb) || jsonb_build_object('vatTreatment', 'standard')
 where coalesce(extra->>'source', '') <> 'bank' and btw_amount > 0 and extra->>'vatTreatment' is null;

-- ── 4. Klantbetalingen in de bank koppelen aan hun factuur ────────────────────
update public.bank_transactions t set status = 'matched', matched_invoice_id = i.id
  from public.invoices i
 where t.status = 'unmatched' and t.amount > 0 and (
   (t.date = '2026-06-09' and t.amount = 1815.00 and t.counterparty = 'Ahasend B.V.' and i.number = '2026-0004') or
   (t.date = '2026-06-05' and t.amount = 63.94   and t.reference ilike '2026-0007%'   and i.number = '2026-0007') or
   (t.date = '2026-05-05' and t.amount = 338.80  and t.reference = 'INV-022026'      and i.number = 'INV-020226')
 );

-- ── 5. Overboekingen tussen eigen rekeningen / privé-stortingen markeren ──────
--    Dit is geen omzet (anders telt het mee als inkomsten).
update public.bank_transactions
   set status = 'personal', notes = coalesce(notes, 'Privé-storting / eigen inbreng')
 where status = 'unmatched' and description ilike 'From Paul D%';
update public.bank_transactions
   set status = 'ignored', notes = coalesce(notes, 'Interne overboeking tussen eigen rekeningen')
 where status = 'unmatched'
   and description ~* '^(from|to) (btw rekening|main|euro|eur main)\M';

commit;

-- ── Resultaat ─────────────────────────────────────────────────────────────────
select 'factuur' as wat, number as intern, extra->>'numberAsSent' as detail, issue_date::text as datum
  from public.invoices where extra ? 'numberAsSent'
union all
select 'bon BTW', vendor, extra->>'vatTreatment', date::text from public.expenses where extra ? 'bankFixed20261102'
union all
select 'bank', status, count(*)::text, null from public.bank_transactions group by status
order by 1, 4;
