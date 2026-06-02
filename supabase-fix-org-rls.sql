-- ============================================================
-- FIX: Laat ingelogde gebruikers een organisatie aanmaken
-- Plak dit in Supabase → SQL Editor → Run
-- ============================================================

-- Verwijder de oude admin-only insert policy (als die bestaat)
drop policy if exists "authenticated_create_org" on public.organizations;

-- Elke ingelogde gebruiker mag een nieuwe organisatie aanmaken
create policy "authenticated_create_org" on public.organizations
  for insert
  with check (auth.uid() is not null);

-- Verificatie
select policyname, cmd from pg_policies
where tablename = 'organizations'
order by policyname;
