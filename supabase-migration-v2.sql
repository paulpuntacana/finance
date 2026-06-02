-- ============================================================
-- DHS Finance — Migration v2: Aparte tabellen per entiteitstype
-- Vervangt de JSONB user_data / org_data aanpak
--
-- Stap 1: Plak dit in Supabase → SQL Editor → Run
-- Stap 2: Zie onderaan voor profiel-fix
-- ============================================================

-- ── Drop oude JSONB tabellen ──────────────────────────────────
drop table if exists public.user_data cascade;
drop table if exists public.org_data cascade;

-- ── updated_at trigger (hergebruik bestaande functie) ─────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============================================================
-- FACTUREN
-- ============================================================
create table public.invoices (
  id          text        not null primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  org_id      uuid        references public.organizations(id) on delete cascade,
  entity_id   text,
  status      text,
  item_date   date,
  total       numeric     default 0,
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint invoices_owner check (user_id is not null or org_id is not null)
);
create index idx_invoices_user   on public.invoices (user_id) where user_id is not null;
create index idx_invoices_org    on public.invoices (org_id)  where org_id  is not null;
create index idx_invoices_status on public.invoices (status);
create trigger trg_invoices_upd before update on public.invoices
  for each row execute function public.set_updated_at();

-- ============================================================
-- KLANTEN
-- ============================================================
create table public.clients (
  id          text        not null primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  org_id      uuid        references public.organizations(id) on delete cascade,
  entity_id   text,
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint clients_owner check (user_id is not null or org_id is not null)
);
create index idx_clients_user on public.clients (user_id) where user_id is not null;
create index idx_clients_org  on public.clients (org_id)  where org_id  is not null;
create trigger trg_clients_upd before update on public.clients
  for each row execute function public.set_updated_at();

-- ============================================================
-- BONNEN / ONKOSTEN
-- ============================================================
create table public.expenses (
  id          text        not null primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  org_id      uuid        references public.organizations(id) on delete cascade,
  entity_id   text,
  status      text,
  item_date   date,
  total       numeric     default 0,
  receipt_url text,       -- Supabase Storage URL (toekomstig gebruik)
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint expenses_owner check (user_id is not null or org_id is not null)
);
create index idx_expenses_user on public.expenses (user_id) where user_id is not null;
create index idx_expenses_org  on public.expenses (org_id)  where org_id  is not null;
create trigger trg_expenses_upd before update on public.expenses
  for each row execute function public.set_updated_at();

-- ============================================================
-- OFFERTES
-- ============================================================
create table public.quotes (
  id          text        not null primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  org_id      uuid        references public.organizations(id) on delete cascade,
  entity_id   text,
  status      text,
  item_date   date,
  total       numeric     default 0,
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint quotes_owner check (user_id is not null or org_id is not null)
);
create index idx_quotes_user on public.quotes (user_id) where user_id is not null;
create index idx_quotes_org  on public.quotes (org_id)  where org_id  is not null;
create trigger trg_quotes_upd before update on public.quotes
  for each row execute function public.set_updated_at();

-- ============================================================
-- INKOOPFACTUREN
-- ============================================================
create table public.purchase_invoices (
  id          text        not null primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  org_id      uuid        references public.organizations(id) on delete cascade,
  entity_id   text,
  status      text,
  item_date   date,
  total       numeric     default 0,
  receipt_url text,       -- Supabase Storage URL (toekomstig gebruik)
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint purchase_invoices_owner check (user_id is not null or org_id is not null)
);
create index idx_pinv_user on public.purchase_invoices (user_id) where user_id is not null;
create index idx_pinv_org  on public.purchase_invoices (org_id)  where org_id  is not null;
create trigger trg_pinv_upd before update on public.purchase_invoices
  for each row execute function public.set_updated_at();

-- ============================================================
-- RECHTSPERSONEN / BEDRIJVEN (entities)
-- ============================================================
create table public.entities (
  id          text        not null primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  org_id      uuid        references public.organizations(id) on delete cascade,
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint entities_owner check (user_id is not null or org_id is not null)
);
create index idx_entities_user on public.entities (user_id) where user_id is not null;
create index idx_entities_org  on public.entities (org_id)  where org_id  is not null;
create trigger trg_entities_upd before update on public.entities
  for each row execute function public.set_updated_at();

-- ============================================================
-- BOEKHOUDING — ACTIVA
-- ============================================================
create table public.boek_assets (
  id          text        not null primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  org_id      uuid        references public.organizations(id) on delete cascade,
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint boek_assets_owner check (user_id is not null or org_id is not null)
);
create index idx_boek_assets_user on public.boek_assets (user_id) where user_id is not null;
create trigger trg_boek_assets_upd before update on public.boek_assets
  for each row execute function public.set_updated_at();

-- ============================================================
-- BOEKHOUDING — BOEKINGEN
-- ============================================================
create table public.boek_entries (
  id          text        not null primary key,
  user_id     uuid        references auth.users(id) on delete cascade,
  org_id      uuid        references public.organizations(id) on delete cascade,
  item_date   date,
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint boek_entries_owner check (user_id is not null or org_id is not null)
);
create index idx_boek_entries_user on public.boek_entries (user_id) where user_id is not null;
create trigger trg_boek_entries_upd before update on public.boek_entries
  for each row execute function public.set_updated_at();

-- ============================================================
-- GEBRUIKERSINSTELLINGEN
-- ============================================================
create table public.user_settings (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  org_id      uuid        references public.organizations(id) on delete cascade,
  data        jsonb       not null default '{}',
  updated_at  timestamptz not null default now()
);
create trigger trg_user_settings_upd before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- HORIZON PLANNER DATA
-- ============================================================
create table public.horizon_data (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  org_id      uuid        references public.organizations(id) on delete cascade,
  data        jsonb       not null default '{}',
  updated_at  timestamptz not null default now()
);
create trigger trg_horizon_data_upd before update on public.horizon_data
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.invoices          enable row level security;
alter table public.clients           enable row level security;
alter table public.expenses          enable row level security;
alter table public.quotes            enable row level security;
alter table public.purchase_invoices enable row level security;
alter table public.entities          enable row level security;
alter table public.boek_assets       enable row level security;
alter table public.boek_entries      enable row level security;
alter table public.user_settings     enable row level security;
alter table public.horizon_data      enable row level security;

-- ── RLS helper: is platform admin? ───────────────────────────
create or replace function public.is_platform_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'platform_admin'
  );
$$;

-- ── Macro: zelfde policy voor elke tabel (user / org / admin) ─
-- invoices
create policy "invoices_access" on public.invoices for all using (
  user_id = auth.uid()
  or org_id in (select organization_id from public.profiles where id = auth.uid())
  or public.is_platform_admin()
);
-- clients
create policy "clients_access" on public.clients for all using (
  user_id = auth.uid()
  or org_id in (select organization_id from public.profiles where id = auth.uid())
  or public.is_platform_admin()
);
-- expenses
create policy "expenses_access" on public.expenses for all using (
  user_id = auth.uid()
  or org_id in (select organization_id from public.profiles where id = auth.uid())
  or public.is_platform_admin()
);
-- quotes
create policy "quotes_access" on public.quotes for all using (
  user_id = auth.uid()
  or org_id in (select organization_id from public.profiles where id = auth.uid())
  or public.is_platform_admin()
);
-- purchase_invoices
create policy "purchase_invoices_access" on public.purchase_invoices for all using (
  user_id = auth.uid()
  or org_id in (select organization_id from public.profiles where id = auth.uid())
  or public.is_platform_admin()
);
-- entities
create policy "entities_access" on public.entities for all using (
  user_id = auth.uid()
  or org_id in (select organization_id from public.profiles where id = auth.uid())
  or public.is_platform_admin()
);
-- boek_assets
create policy "boek_assets_access" on public.boek_assets for all using (
  user_id = auth.uid()
  or org_id in (select organization_id from public.profiles where id = auth.uid())
  or public.is_platform_admin()
);
-- boek_entries
create policy "boek_entries_access" on public.boek_entries for all using (
  user_id = auth.uid()
  or org_id in (select organization_id from public.profiles where id = auth.uid())
  or public.is_platform_admin()
);
-- user_settings (alleen eigen rij)
create policy "user_settings_access" on public.user_settings for all using (
  user_id = auth.uid()
  or public.is_platform_admin()
);
-- horizon_data (alleen eigen rij)
create policy "horizon_data_access" on public.horizon_data for all using (
  user_id = auth.uid()
  or public.is_platform_admin()
);

-- ============================================================
-- PROFIEL FIX
-- Verander 'JOUW_EMAIL@HIER.COM' en voer dit los uit
-- als je profiel nog niet in de tabel staat.
-- ============================================================
-- insert into public.profiles (id, email, full_name, role, organization_id, is_active)
-- select
--   id,
--   email,
--   coalesce(raw_user_meta_data->>'full_name', split_part(email,'@',1)),
--   'platform_admin',
--   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--   true
-- from auth.users
-- where email = 'JOUW_EMAIL@HIER.COM'
-- on conflict (id) do update
--   set role = 'platform_admin',
--       organization_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--       is_active = true;
