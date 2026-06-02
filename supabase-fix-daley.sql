-- ============================================================
-- Maak organisatie aan voor Daley en koppel zijn account
-- Plak dit in Supabase → SQL Editor → Run
-- ============================================================

-- 1. Maak de organisatie aan
insert into public.organizations (id, name, plan, invite_code)
values (
  gen_random_uuid(),
  'Future Marketing',
  'starter',
  'FM2026'
)
on conflict do nothing;

-- 2. Koppel profiel aan de nieuwe organisatie
update public.profiles
set
  organization_id = (select id from public.organizations where name = 'Future Marketing' limit 1),
  role            = 'org_owner',
  is_active       = true
where id = '123fd683-0337-49a4-ad20-2af368d45f8b';

-- Verificatie
select p.id, p.email, p.full_name, p.role, p.organization_id, o.name as org_name
from public.profiles p
left join public.organizations o on o.id = p.organization_id
where p.id = '123fd683-0337-49a4-ad20-2af368d45f8b';
