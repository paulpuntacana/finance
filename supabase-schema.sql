-- ============================================================
-- DHS Finance — Volledig database schema
-- Plak dit in Supabase → SQL Editor → Run
-- ============================================================

-- 1. ORGANIZATIONS
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        text not null default 'starter' check (plan in ('starter','pro','enterprise')),
  invite_code text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. PROFILES
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  full_name       text,
  role            text not null default 'org_owner'
                    check (role in ('platform_admin','org_owner','accountant','employee')),
  organization_id uuid references public.organizations(id) on delete set null,
  is_active       boolean not null default true,
  access_type     text default 'owner' check (access_type in ('owner','bewerk','meekijk')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3. USER_DATA (persoonlijke app-data per gebruiker)
create table if not exists public.user_data (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  settings          jsonb default '{}',
  clients           jsonb default '[]',
  invoices          jsonb default '[]',
  expenses          jsonb default '[]',
  entities          jsonb default '[]',
  quotes            jsonb default '[]',
  purchase_invoices jsonb default '[]',
  boek_assets       jsonb default '[]',
  boek_entries      jsonb default '[]',
  "horizonData"     jsonb default '{}',
  updated_at        timestamptz not null default now(),
  unique(user_id)
);

-- 4. ORG_DATA (gedeelde data per organisatie)
create table if not exists public.org_data (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  settings          jsonb default '{}',
  clients           jsonb default '[]',
  invoices          jsonb default '[]',
  expenses          jsonb default '[]',
  entities          jsonb default '[]',
  quotes            jsonb default '[]',
  purchase_invoices jsonb default '[]',
  boek_assets       jsonb default '[]',
  boek_entries      jsonb default '[]',
  "horizonData"     jsonb default '{}',
  updated_at        timestamptz not null default now(),
  unique(org_id)
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.organizations enable row level security;
alter table public.profiles       enable row level security;
alter table public.user_data      enable row level security;
alter table public.org_data       enable row level security;

create policy "admin_all_orgs" on public.organizations for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin'));
create policy "user_own_org" on public.organizations for select
  using (id in (select organization_id from public.profiles where id = auth.uid()));

create policy "own_profile" on public.profiles for all using (id = auth.uid());
create policy "admin_all_profiles" on public.profiles for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin'));
create policy "org_members_see_each_other" on public.profiles for select
  using (organization_id in (select organization_id from public.profiles where id = auth.uid()));

create policy "own_user_data" on public.user_data for all using (user_id = auth.uid());

create policy "org_data_access" on public.org_data for all
  using (
    org_id in (select organization_id from public.profiles where id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('platform_admin','accountant'))
  );

-- ============================================================
-- TRIGGERS
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

create trigger trg_orgs_upd     before update on public.organizations for each row execute function public.set_updated_at();
create trigger trg_profiles_upd before update on public.profiles       for each row execute function public.set_updated_at();
create trigger trg_udata_upd    before update on public.user_data      for each row execute function public.set_updated_at();
create trigger trg_odata_upd    before update on public.org_data       for each row execute function public.set_updated_at();

-- Auto-profiel bij nieuwe registratie
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    'org_owner')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SEED: Den Hartogh Solutions organisatie
-- ============================================================
insert into public.organizations (id, name, plan, invite_code)
values ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Den Hartogh Solutions', 'pro', 'DHS2026')
on conflict do nothing;

-- ============================================================
-- STAP 2 (na registratie): vervang e-mail en run nogmaals
-- ============================================================
-- update public.profiles
-- set role = 'platform_admin',
--     full_name = 'Paul den Hartogh',
--     organization_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--     is_active = true
-- where email = 'JOUW_EMAIL_HIER';
