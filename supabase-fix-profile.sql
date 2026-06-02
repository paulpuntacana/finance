-- ============================================================
-- DHS Finance — PROFIEL FIX
-- Stap: na registratie in de app, run dit in Supabase SQL Editor
--
-- 1. Vervang JOUW_EMAIL@HIER.NL met je werkelijke e-mailadres
-- 2. Plak het volledige script in Supabase → SQL Editor → Run
-- ============================================================

-- STAP 1: vervang het e-mailadres hieronder
update public.profiles
set
  role            = 'platform_admin',
  full_name       = 'Paul den Hartogh',
  organization_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  is_active       = true
where email = 'JOUW_EMAIL@HIER.NL';  -- <-- vervang dit

-- Verificatie: zie je je profiel?
select id, email, role, organization_id, is_active
from public.profiles
limit 10;
