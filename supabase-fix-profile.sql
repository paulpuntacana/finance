-- ============================================================
-- PROBLEEM 1 FIX: Voeg je profiel toe als platform_admin
-- ============================================================
-- STAP 1: Voer dit uit in Supabase SQL Editor
-- (Vervang JOUW_EMAIL_HIER met je werkelijke e-mailadres)

update public.profiles
set role = 'platform_admin',
    full_name = 'Paul den Hartogh',
    organization_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    is_active = true
where email = 'JOUW_EMAIL_HIER';

-- Verificatie:
select id, email, role, organization_id, is_active from public.profiles limit 5;
