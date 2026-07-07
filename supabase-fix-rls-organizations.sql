-- ============================================================
-- FIX: RLS was uitgeschakeld op public.organizations
-- Advisor: "Policy Exists RLS Disabled" + "RLS Disabled in Public"
-- De policies bestaan al, maar worden niet afgedwongen zonder RLS aan.
-- Plak dit in Supabase → SQL Editor → Run
-- ============================================================

alter table public.organizations enable row level security;

-- Verificatie: rowsecurity moet nu 'true' zijn
select relname, relrowsecurity
from pg_class
where relname = 'organizations';
