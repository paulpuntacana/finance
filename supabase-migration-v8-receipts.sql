-- ============================================================
-- Migration v8 — Bonnen in Supabase Storage
-- Uitvoeren NA supabase-migration-v7-security.sql (SQL Editor).
--
-- Bonfoto's/PDF's stonden als base64 in expenses.extra (en in localStorage). Nu gaan ze
-- naar een privé bucket `receipts`; de kostenpost bewaart alleen het pad (receiptPath)
-- en een klein thumbnail. Pad-indeling: <org_id>/<expense_id>/<bestand>.
-- ============================================================

-- 1. Privé bucket (max 15 MB per bestand, alleen afbeeldingen en PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

-- 2. RLS: alleen bestanden onder de eigen org-map (eerste mapnaam = org id)
drop policy if exists "receipts_select_own_org" on storage.objects;
drop policy if exists "receipts_insert_own_org" on storage.objects;
drop policy if exists "receipts_update_own_org" on storage.objects;
drop policy if exists "receipts_delete_own_org" on storage.objects;

create policy "receipts_select_own_org" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = public.user_org_id()::text or public.is_platform_admin()));

create policy "receipts_insert_own_org" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and ((storage.foldername(name))[1] = public.user_org_id()::text or public.is_platform_admin()));

create policy "receipts_update_own_org" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = public.user_org_id()::text or public.is_platform_admin()))
  with check (bucket_id = 'receipts' and ((storage.foldername(name))[1] = public.user_org_id()::text or public.is_platform_admin()));

create policy "receipts_delete_own_org" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = public.user_org_id()::text or public.is_platform_admin()));

-- 3. Vangnet voor de localStorage-cache: daar worden grote base64-velden (image/attachment)
--    weggelaten en gemarkeerd met extra.receiptStripped = ["image", ...]. Wordt zo'n
--    ingekort record ooit gesynct (bv. wijziging vóór de verse serverdata binnen is), dan
--    zet deze trigger de oorspronkelijke base64 terug i.p.v. hem te wissen.
create or replace function public.expenses_keep_stripped_receipt()
returns trigger language plpgsql as $$
declare
  f text;
begin
  if new.extra ? 'receiptStripped' then
    for f in select jsonb_array_elements_text(coalesce(new.extra->'receiptStripped', '[]'::jsonb)) loop
      if old.extra ? f and not (new.extra ? f and new.extra->>f is not null) then
        new.extra := jsonb_set(new.extra, array[f], old.extra->f);
      end if;
    end loop;
    new.extra := new.extra - 'receiptStripped';
  end if;
  return new;
end $$;

drop trigger if exists expenses_keep_stripped_receipt on public.expenses;
create trigger expenses_keep_stripped_receipt
  before update on public.expenses
  for each row execute function public.expenses_keep_stripped_receipt();
