-- ============================================================
-- DHS Finance — Migration v5: Bank bewegingen (Revolut import)
-- Voer uit in: Supabase → SQL Editor → Run
-- ============================================================

create table public.bank_transactions (
  id                 text        not null primary key,
  org_id             uuid        not null references public.organizations(id) on delete cascade,
  entity_id          text        references public.entities(id) on delete set null,
  external_id        text,
  account            text,
  date               date        not null,
  description        text,
  counterparty       text,
  reference          text,
  type               text,
  amount             numeric(12,2) not null,
  currency           text        default 'EUR',
  orig_amount        numeric(12,2),
  orig_currency      text,
  fee                numeric(12,2) default 0,
  balance            numeric(12,2),
  status             text        not null default 'unmatched',
  matched_invoice_id  text,
  matched_expense_id  text,
  boek_entry_id       text,
  ai_ledger_code      text,
  ai_category         text,
  ai_confidence       numeric,
  ai_note             text,
  notes              text,
  extra              jsonb       default '{}',
  created_at         timestamptz not null default now(),
  constraint bank_transactions_status_chk check (status in ('unmatched','matched','personal','ignored'))
);
create index idx_bank_transactions_org      on public.bank_transactions (org_id);
create index idx_bank_transactions_date     on public.bank_transactions (date);
-- Let op: interne overboekingen tussen eigen Revolut-rekeningen delen dezelfde external_id
-- voor beide kanten (bv. "To Main" / "From BTW Rekening"), maar hebben elk een ander account.
-- Daarom op (org_id, external_id, account) i.p.v. alleen (org_id, external_id), anders wordt
-- de tweede kant van zo'n overboeking geblokkeerd als "duplicate" bij het synchroniseren.
create unique index idx_bank_transactions_dedupe on public.bank_transactions (org_id, external_id, account) where external_id is not null;

alter table public.bank_transactions enable row level security;

create policy "bank_transactions_org" on public.bank_transactions for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
