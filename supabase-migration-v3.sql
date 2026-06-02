-- ============================================================
-- DHS Finance — Migration v3: Volledig relationeel schema
-- Vervangt v2 JSONB-aanpak
-- ============================================================

-- ── Drop v2 tabellen ─────────────────────────────────────────
drop table if exists public.invoices          cascade;
drop table if exists public.clients           cascade;
drop table if exists public.expenses          cascade;
drop table if exists public.quotes            cascade;
drop table if exists public.purchase_invoices cascade;
drop table if exists public.entities          cascade;
drop table if exists public.boek_assets       cascade;
drop table if exists public.boek_entries      cascade;
drop table if exists public.user_settings     cascade;
drop table if exists public.horizon_data      cascade;

-- ── updated_at trigger ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============================================================
-- RECHTSPERSONEN / BEDRIJFSENTITEITEN
-- ============================================================
create table public.entities (
  id                  text        not null primary key,
  org_id              uuid        not null references public.organizations(id) on delete cascade,
  name                text        not null,
  jurisdiction        text        default 'NL',
  currency            text        default 'EUR',
  invoice_prefix      text        default '2026-',
  next_invoice_number integer     default 1,
  payment_terms       integer     default 14,
  default_btw_rate    integer     default 21,
  is_active           boolean     default true,
  extra               jsonb       default '{}',
  created_at          timestamptz not null default now()
);
create index idx_entities_org on public.entities (org_id);

-- ============================================================
-- KLANTEN
-- ============================================================
create table public.clients (
  id           text        not null primary key,
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  entity_id    text        references public.entities(id) on delete set null,
  name         text        not null,
  contact_name text,
  email        text,
  phone        text,
  address      text,
  postal       text,
  city         text,
  country      text        default 'Nederland',
  btw_number   text,
  kvk_number   text,
  notes        text,
  is_active    boolean     default true,
  extra        jsonb       default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_clients_org    on public.clients (org_id);
create index idx_clients_entity on public.clients (entity_id);
create trigger trg_clients_upd before update on public.clients
  for each row execute function public.set_updated_at();

-- ============================================================
-- VERKOOPFACTUREN
-- ============================================================
create table public.invoices (
  id              text        not null primary key,
  org_id          uuid        not null references public.organizations(id) on delete cascade,
  entity_id       text        references public.entities(id) on delete set null,
  client_id       text        references public.clients(id) on delete set null,
  number          text        not null,
  issue_date      date        not null,
  due_date        date,
  status          text        default 'draft',
  currency        text        default 'EUR',
  notes           text,
  internal_notes  text,
  subject         text,
  subtotal        numeric(12,2),
  btw_total       numeric(12,2),
  total           numeric(12,2),
  paid_amount     numeric(12,2) default 0,
  sent_at         timestamptz,
  paid_at         timestamptz,
  sign_token      text        unique,
  signed_at       timestamptz,
  signed_by_name  text,
  signed_by_ip    text,
  extra           jsonb       default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_invoices_org    on public.invoices (org_id);
create index idx_invoices_entity on public.invoices (entity_id);
create index idx_invoices_client on public.invoices (client_id);
create index idx_invoices_status on public.invoices (status);
create index idx_invoices_date   on public.invoices (issue_date);
create trigger trg_invoices_upd before update on public.invoices
  for each row execute function public.set_updated_at();

create table public.invoice_items (
  id             uuid        primary key default gen_random_uuid(),
  invoice_id     text        not null references public.invoices(id) on delete cascade,
  sort_order     integer     default 0,
  description    text        not null,
  quantity       numeric(10,4) default 1,
  unit_price     numeric(12,2) not null default 0,
  btw_rate       numeric(5,2)  default 21,
  discount_type  text,
  discount_value numeric(10,2) default 0,
  discount_name  text,
  line_net       numeric(12,2)
);
create index idx_invoice_items_inv on public.invoice_items (invoice_id);

create table public.invoice_reminders (
  id           uuid        primary key default gen_random_uuid(),
  invoice_id   text        not null references public.invoices(id) on delete cascade,
  sent_at      timestamptz default now(),
  channel      text,
  template_name text,
  days_overdue integer
);
create index idx_invoice_reminders_inv on public.invoice_reminders (invoice_id);

-- ============================================================
-- OFFERTES
-- ============================================================
create table public.quotes (
  id                       text        not null primary key,
  org_id                   uuid        not null references public.organizations(id) on delete cascade,
  entity_id                text        references public.entities(id) on delete set null,
  client_id                text        references public.clients(id) on delete set null,
  number                   text,
  issue_date               date        not null,
  valid_until              date,
  status                   text        default 'draft',
  currency                 text        default 'EUR',
  notes                    text,
  subject                  text,
  subtotal                 numeric(12,2),
  btw_total                numeric(12,2),
  total                    numeric(12,2),
  sign_token               text        unique,
  signed_at                timestamptz,
  signed_by_name           text,
  signed_by_ip             text,
  converted_to_invoice_id  text        references public.invoices(id) on delete set null,
  sent_at                  timestamptz,
  extra                    jsonb       default '{}',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index idx_quotes_org    on public.quotes (org_id);
create index idx_quotes_status on public.quotes (status);
create trigger trg_quotes_upd before update on public.quotes
  for each row execute function public.set_updated_at();

create table public.quote_items (
  id             uuid        primary key default gen_random_uuid(),
  quote_id       text        not null references public.quotes(id) on delete cascade,
  sort_order     integer     default 0,
  description    text        not null,
  quantity       numeric(10,4) default 1,
  unit_price     numeric(12,2) not null default 0,
  btw_rate       numeric(5,2)  default 21,
  discount_type  text,
  discount_value numeric(10,2) default 0,
  discount_name  text,
  line_net       numeric(12,2)
);
create index idx_quote_items_q on public.quote_items (quote_id);

-- ============================================================
-- INKOOPFACTUREN
-- ============================================================
create table public.purchase_invoices (
  id               text        not null primary key,
  org_id           uuid        not null references public.organizations(id) on delete cascade,
  entity_id        text        references public.entities(id) on delete set null,
  supplier         text        not null,
  invoice_number   text,
  date             date,
  due_date         date,
  amount_excl      numeric(12,2),
  btw_rate         numeric(5,2)  default 21,
  btw_amount       numeric(12,2),
  total_amount     numeric(12,2),
  currency         text        default 'EUR',
  category         text,
  ledger_code      text,
  status           text        default 'unpaid',
  paid_at          date,
  attachment_url   text,
  attachment_name  text,
  notes            text,
  recurring        boolean     default false,
  recurring_period text,
  extra            jsonb       default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_pinv_org    on public.purchase_invoices (org_id);
create index idx_pinv_entity on public.purchase_invoices (entity_id);
create index idx_pinv_status on public.purchase_invoices (status);
create trigger trg_pinv_upd before update on public.purchase_invoices
  for each row execute function public.set_updated_at();

-- ============================================================
-- KOSTEN / BONNEN
-- ============================================================
create table public.expenses (
  id           text        not null primary key,
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  entity_id    text        references public.entities(id) on delete set null,
  description  text        not null,
  vendor       text,
  date         date        not null,
  amount_incl  numeric(12,2) not null,
  btw_rate     numeric(5,2)  default 21,
  btw_amount   numeric(12,2),
  amount_excl  numeric(12,2),
  category     text,
  ledger_code  text,
  currency     text        default 'EUR',
  receipt_url  text,
  receipt_name text,
  notes        text,
  created_by   uuid        references public.profiles(id) on delete set null,
  extra        jsonb       default '{}',
  created_at   timestamptz not null default now()
);
create index idx_expenses_org    on public.expenses (org_id);
create index idx_expenses_entity on public.expenses (entity_id);
create index idx_expenses_date   on public.expenses (date);

-- ============================================================
-- BOEKHOUDING — ACTIVA
-- ============================================================
create table public.boek_assets (
  id                 text        not null primary key,
  org_id             uuid        not null references public.organizations(id) on delete cascade,
  entity_id          text        references public.entities(id) on delete set null,
  name               text        not null,
  category           text,
  purchase_date      date,
  purchase_value     numeric(12,2),
  residual_value     numeric(12,2) default 0,
  depreciation_years integer     default 5,
  is_active          boolean     default true,
  notes              text,
  extra              jsonb       default '{}',
  created_at         timestamptz not null default now()
);
create index idx_boek_assets_org on public.boek_assets (org_id);

-- ============================================================
-- BOEKHOUDING — JOURNAALPOSTEN
-- ============================================================
create table public.boek_entries (
  id           text        not null primary key,
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  entity_id    text        references public.entities(id) on delete set null,
  date         date        not null,
  category     text,
  description  text,
  amount       numeric(12,2),
  is_debit     boolean     default true,
  ledger_code  text,
  reference    text,
  extra        jsonb       default '{}',
  created_at   timestamptz not null default now()
);
create index idx_boek_entries_org  on public.boek_entries (org_id);
create index idx_boek_entries_date on public.boek_entries (date);

-- ============================================================
-- ORGANISATIE-INSTELLINGEN
-- ============================================================
create table public.org_settings (
  org_id                   uuid    primary key references public.organizations(id) on delete cascade,
  company_name             text,
  company_address          text,
  company_postal           text,
  company_city             text,
  company_country          text,
  company_kvk              text,
  company_btw              text,
  company_iban             text,
  company_bic              text,
  company_email            text,
  company_phone            text,
  company_website          text,
  company_logo_url         text,
  invoice_prefix           text,
  invoice_footer           text,
  invoice_accent_color     text,
  default_btw_rate         integer default 21,
  payment_terms            integer default 14,
  email_from_name          text,
  email_from_email         text,
  resend_api_key           text,
  whatsapp_number          text,
  reminders_enabled        boolean default true,
  reminder_days            integer[] default '{7,14,21}',
  jurisdiction             text    default 'NL',
  base_currency            text    default 'EUR',
  enabled_currencies       text[],
  credit_mgmt_enabled      boolean default true,
  late_payment_threshold   integer default 3,
  high_value_threshold     numeric(12,2) default 5000,
  extra                    jsonb   default '{}',
  updated_at               timestamptz not null default now()
);
create trigger trg_org_settings_upd before update on public.org_settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- HERINNERINGSTEMPLATES
-- ============================================================
create table public.reminder_templates (
  id         uuid    primary key default gen_random_uuid(),
  org_id     uuid    not null references public.organizations(id) on delete cascade,
  name       text    not null,
  subject    text,
  body       text,
  sort_order integer default 0
);
create index idx_reminder_templates_org on public.reminder_templates (org_id);

-- ============================================================
-- HORIZON PLANNER SCENARIOS
-- ============================================================
create table public.horizon_scenarios (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references public.organizations(id) on delete cascade,
  entity_id  text        references public.entities(id) on delete set null,
  name       text        not null,
  year       integer     not null,
  data       jsonb       not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_horizon_org on public.horizon_scenarios (org_id);
create trigger trg_horizon_upd before update on public.horizon_scenarios
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.entities           enable row level security;
alter table public.clients            enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_items      enable row level security;
alter table public.invoice_reminders  enable row level security;
alter table public.quotes             enable row level security;
alter table public.quote_items        enable row level security;
alter table public.purchase_invoices  enable row level security;
alter table public.expenses           enable row level security;
alter table public.boek_assets        enable row level security;
alter table public.boek_entries       enable row level security;
alter table public.org_settings       enable row level security;
alter table public.reminder_templates enable row level security;
alter table public.horizon_scenarios  enable row level security;

create or replace function public.is_platform_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin');
$$;

create or replace function public.user_org_id()
returns uuid language sql security definer stable as $$
  select organization_id from public.profiles where id = auth.uid() limit 1;
$$;

-- Macro: org-lid heeft toegang tot alle org-data
-- entities
create policy "entities_org" on public.entities for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
-- clients
create policy "clients_org" on public.clients for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
-- invoices
create policy "invoices_org" on public.invoices for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
-- invoice_items (via parent invoice)
create policy "invoice_items_org" on public.invoice_items for all using (
  invoice_id in (select id from public.invoices where org_id = public.user_org_id())
  or public.is_platform_admin()
);
-- invoice_reminders (via parent invoice)
create policy "invoice_reminders_org" on public.invoice_reminders for all using (
  invoice_id in (select id from public.invoices where org_id = public.user_org_id())
  or public.is_platform_admin()
);
-- quotes
create policy "quotes_org" on public.quotes for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
-- quote_items
create policy "quote_items_org" on public.quote_items for all using (
  quote_id in (select id from public.quotes where org_id = public.user_org_id())
  or public.is_platform_admin()
);
-- purchase_invoices
create policy "purchase_invoices_org" on public.purchase_invoices for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
-- expenses
create policy "expenses_org" on public.expenses for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
-- boek_assets
create policy "boek_assets_org" on public.boek_assets for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
-- boek_entries
create policy "boek_entries_org" on public.boek_entries for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
-- org_settings
create policy "org_settings_org" on public.org_settings for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
-- reminder_templates
create policy "reminder_templates_org" on public.reminder_templates for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
-- horizon_scenarios
create policy "horizon_scenarios_org" on public.horizon_scenarios for all using (
  org_id = public.user_org_id() or public.is_platform_admin()
);
