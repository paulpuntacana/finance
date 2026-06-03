-- ============================================================
-- DHS Finance — Avatar kolom toevoegen aan profiles tabel
-- Uitvoeren in: Supabase Dashboard > SQL Editor
-- ============================================================

alter table public.profiles
  add column if not exists avatar_url text;
