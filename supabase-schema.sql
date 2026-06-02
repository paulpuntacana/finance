-- DHS Finance — Supabase Schema
-- Run this in Supabase → SQL Editor

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id),
  plan text default 'starter',
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz default now()
);

alter table public.organizations enable row level security;

create policy "Org members see their org" on public.organizations
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = organizations.id
    )
  );

create policy "Platform admin sees all orgs" on public.organizations
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'platform_admin'
    )
  );

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  role text default 'org_owner'
    check (role in ('platform_admin', 'org_owner', 'accountant', 'employee')),
  organization_id uuid references public.organizations(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Users can read/update their own profile
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id);

-- Platform admin sees everything
create policy "Platform admin sees all profiles" on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'platform_admin'
    )
  );

-- Org owners/accountants see their org members
create policy "Org admins see org members" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = profiles.organization_id
        and p.role in ('org_owner', 'accountant')
    )
  );

-- ============================================================
-- USER DATA (app data per user — settings, clients, invoices etc.)
-- ============================================================
create table public.user_data (
  user_id uuid references auth.users on delete cascade primary key,
  settings jsonb default '{}',
  clients  jsonb default '[]',
  invoices jsonb default '[]',
  expenses jsonb default '[]',
  entities jsonb default '[]',
  quotes      jsonb default '[]',
  horizonData jsonb default '{}',
  updated_at  timestamptz default now()
);

alter table public.user_data enable row level security;

create policy "Users own their data" on public.user_data
  for all using (auth.uid() = user_id);

create policy "Platform admin reads all data" on public.user_data
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'platform_admin'
    )
  );

-- ============================================================
-- EMPLOYEE EXPENSE SUBMISSIONS
-- ============================================================
create table public.expense_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  employee_id uuid references auth.users(id),
  vendor text,
  amount numeric default 0,
  currency text default 'EUR',
  date text,
  category text,
  description text,
  receipt_data text,  -- base64 image
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz default now()
);

alter table public.expense_submissions enable row level security;

-- Employees see their own submissions
create policy "Employees see own submissions" on public.expense_submissions
  for select using (auth.uid() = employee_id);

create policy "Employees can submit" on public.expense_submissions
  for insert with check (auth.uid() = employee_id);

-- Org owners/accountants see all submissions in their org
create policy "Org admins manage submissions" on public.expense_submissions
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = expense_submissions.organization_id
        and p.role in ('org_owner', 'accountant', 'platform_admin')
    )
  );

-- ============================================================
-- TRIGGER: auto-create profile + user_data on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  insert into public.user_data (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- MAKE YOURSELF PLATFORM ADMIN
-- Run AFTER your first registration:
-- update public.profiles set role = 'platform_admin' where email = 'jouw@email.com';
-- ============================================================

-- ============================================================
-- MIGRATION: Accountant multi-tenant support
-- Run these in Supabase SQL Editor AFTER initial setup
-- ============================================================

-- 1. Add managed_by to organizations (which accountant manages this org)
alter table public.organizations
  add column if not exists managed_by uuid references auth.users(id);

-- 2. Add access_type to profiles (owner | bewerk | meekijk)
alter table public.profiles
  add column if not exists access_type text default 'owner'
    check (access_type in ('owner', 'bewerk', 'meekijk'));

-- 3. Add boek columns to user_data
alter table public.user_data
  add column if not exists boek_assets jsonb default '[]',
  add column if not exists boek_entries jsonb default '[]';

-- 4. Org-level shared data (accountant + org members share one row)
create table if not exists public.org_data (
  org_id      uuid references public.organizations(id) on delete cascade primary key,
  settings    jsonb default '{}',
  clients     jsonb default '[]',
  invoices    jsonb default '[]',
  expenses    jsonb default '[]',
  entities    jsonb default '[]',
  quotes      jsonb default '[]',
  horizonData jsonb default '{}',
  boek_assets jsonb default '[]',
  boek_entries jsonb default '[]',
  updated_at  timestamptz default now()
);

alter table public.org_data enable row level security;

-- Org members can access their org's data
create policy "Org members access org_data" on public.org_data
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = org_data.org_id
    )
  );

-- Managing accountant can access all org_data for orgs they manage
create policy "Accountant accesses managed org_data" on public.org_data
  for all using (
    exists (
      select 1 from public.organizations o
      where o.id = org_data.org_id and o.managed_by = auth.uid()
    )
  );

-- Platform admin sees all
create policy "Platform admin accesses all org_data" on public.org_data
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'platform_admin'
    )
  );

-- Accountant can see orgs they manage
create policy "Accountant sees managed orgs" on public.organizations
  for select using (managed_by = auth.uid());
