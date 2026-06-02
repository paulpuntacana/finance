-- ============================================================
-- DHS Finance — Migration v4
-- Voer uit in: Supabase → SQL Editor → Run
-- ============================================================

-- 1. Sta gewone org_owner gebruikers toe om een eigen organisatie aan te maken
--    (platform_admin mag dit al via admin_all_orgs)
create policy if not exists "create_own_org" on public.organizations
  for insert to authenticated
  with check (
    not exists (
      select 1 from public.profiles
      where id = auth.uid()
      and organization_id is not null
    )
  );

-- ============================================================
-- 2. Account vriend aanmaken
--    STAP A: Maak eerst de gebruiker aan via het AdminPanel
--            (/admin → Gebruikers → Nieuwe gebruiker)
--            of via Supabase Dashboard → Authentication → Users → Add user
--
--    STAP B: Voer daarna onderstaande SQL uit (vervang het e-mailadres indien nodig)
-- ============================================================
update public.profiles
set role = 'platform_admin',
    full_name = 'Future Marketing',
    is_active = true
where email = 'info@future-marketing.ai';

-- Check: heeft het gewerkt?
select id, email, full_name, role, organization_id from public.profiles
where email = 'info@future-marketing.ai';
