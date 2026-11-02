-- =============================================================================
-- DHS Finance — Migratie v7: beveiliging (RLS, rollen, publieke onderteken-links)
-- =============================================================================
-- Uitvoeren: Supabase Dashboard → SQL Editor → plakken → Run (als postgres).
-- Idempotent: mag meerdere keren gedraaid worden.
--
-- Wat deze migratie oplost:
--   1. Helper-functies: vaste search_path, is_active wordt gerespecteerd,
--      nieuwe helpers is_org_owner / has_finance_access / can_write_finance.
--   2. profiles: gebruiker kan zichzelf NIET meer tot platform_admin promoveren
--      of zich bij een willekeurige organisatie aansluiten (guard-trigger +
--      strakkere policies). Org-owners mogen leden van hun eigen org beheren.
--   3. organizations: policies opgeschoond (geen dubbele INSERT-policies meer,
--      alleen owner/admin mag wijzigen, aanmaken alleen zonder bestaande org).
--      Nieuwe kolom created_by + RPC's create_organization / join_org_by_invite.
--   4. Financiële tabellen: extra RESTRICTIVE gate — alleen org_owner/accountant
--      (en platform_admin) lezen; 'meekijk'-accounts mogen niet schrijven.
--   5. Publieke onderteken-links: brede *_public_sign policies weg; in plaats
--      daarvan RPC's get_quote_by_token / sign_quote (SECURITY DEFINER).
--   6. user_settings-tabel aangemaakt (bestond niet) met strikte RLS.
--   7. EXECUTE-rechten op functies aangescherpt (anon kan niets meer aanroepen
--      behalve de publieke onderteken-RPC's).
--
-- NIET aangeraakt: li_accounts / li_posts / li_mentions / pb_* (andere app).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Helper-functies (SECURITY DEFINER, vaste search_path)
-- -----------------------------------------------------------------------------
-- is_platform_admin / user_org_id worden in alle RLS-policies gebruikt.
-- Ze negeren nu gedeactiveerde accounts (is_active = false) → een gedeactiveerde
-- gebruiker verliest direct alle toegang tot org-data.

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'platform_admin'
      and coalesce(is_active, true)
  );
$$;

create or replace function public.user_org_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select organization_id from public.profiles
  where id = auth.uid() and coalesce(is_active, true)
  limit 1;
$$;

-- Is de aanroeper org_owner van zijn (actieve) organisatie?
create or replace function public.is_org_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'org_owner'
      and organization_id is not null
      and coalesce(is_active, true)
  );
$$;

-- Mag de aanroeper financiële data van zijn org LEZEN?
-- (platform_admin, org_owner, accountant — NIET employee)
create or replace function public.has_finance_access()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and organization_id is not null
      and coalesce(is_active, true)
      and role in ('org_owner', 'accountant')
  );
$$;

-- Mag de aanroeper financiële data SCHRIJVEN? (zoals lezen, maar niet 'meekijk')
create or replace function public.can_write_finance()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and organization_id is not null
      and coalesce(is_active, true)
      and role in ('org_owner', 'accountant')
      and coalesce(access_type, 'owner') <> 'meekijk'
  );
$$;

-- Wie heeft deze organisatie aangemaakt? (voor de guard-trigger)
-- Kolom eerst toevoegen zodat de functie compileert.
alter table public.organizations
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

create or replace function public.org_created_by(p_org uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select created_by from public.organizations where id = p_org;
$$;

-- Bestaande trigger-functies: vaste search_path
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Nieuwe gebruiker → profiel. Rol 'org_owner' zonder org is onschadelijk:
-- alle rechten hangen aan organization_id (die alleen via RPC gezet wordt).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'org_owner'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

alter function public.rls_auto_enable() set search_path = pg_catalog;

-- -----------------------------------------------------------------------------
-- 2. profiles — blokkeer zelf-escalatie van rol / organisatie
-- -----------------------------------------------------------------------------
-- Guard-trigger (SECURITY INVOKER, bewust): current_user is
--   'authenticated' bij gewone API-calls  → regels worden afgedwongen
--   'postgres' binnen onze SECURITY DEFINER RPC's / SQL editor → toegestaan
--   'service_role' (edge functions, admin API) → toegestaan
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Vertrouwde context (SQL editor, service_role, SECURITY DEFINER RPC's)
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if v_uid is null then
    raise exception 'Niet ingelogd' using errcode = '42501';
  end if;

  -- id mag nooit wijzigen
  if new.id is distinct from old.id then
    raise exception 'profiles.id kan niet gewijzigd worden' using errcode = '42501';
  end if;

  -- Geen gevoelige velden gewijzigd → altijd ok (naam, avatar, …)
  if new.role is not distinct from old.role
     and new.organization_id is not distinct from old.organization_id
     and new.access_type is not distinct from old.access_type
     and new.is_active is not distinct from old.is_active then
    return new;
  end if;

  -- Platform admin mag alles
  if public.is_platform_admin() then
    return new;
  end if;

  -- (a) Eigen profiel: alleen de "nieuwe org aangemaakt"-overgang (compat met
  --     de huidige createOrg in de frontend): van géén org → een org die je
  --     zelf net hebt aangemaakt, rol blijft gelijk of wordt org_owner.
  if new.id = v_uid then
    if old.organization_id is null
       and new.organization_id is not null
       and public.org_created_by(new.organization_id) = v_uid
       and new.role in (old.role, 'org_owner')
       and new.role <> 'platform_admin'
       and new.access_type is not distinct from old.access_type
       and new.is_active is not distinct from old.is_active then
      return new;
    end if;
    raise exception 'Je kunt je eigen rol/organisatie niet wijzigen' using errcode = '42501';
  end if;

  -- (b) Org-owner beheert een ander lid van de eigen org
  if public.is_org_owner()
     and old.organization_id = public.user_org_id()
     and old.role <> 'platform_admin'
     and (new.organization_id is null or new.organization_id = old.organization_id)
     and new.role in ('org_owner', 'accountant', 'employee')
     and coalesce(new.access_type, 'owner') in ('owner', 'bewerk', 'meekijk') then
    return new;
  end if;

  raise exception 'Onvoldoende rechten om dit profiel te wijzigen' using errcode = '42501';
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged();

-- Policies: own_profile (ALL, zonder WITH CHECK) vervangen.
-- Geen self-INSERT/DELETE meer: het profiel wordt aangemaakt door handle_new_user.
drop policy if exists own_profile on public.profiles;
drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_owner_manage_members on public.profiles;

create policy profiles_self_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Org-owner mag leden van de eigen org bijwerken (activeren/deactiveren,
-- rol employee/accountant/org_owner, access_type). Fijnmazige regels: guard-trigger.
create policy profiles_owner_manage_members on public.profiles
  for update to authenticated
  using (organization_id = (select public.user_org_id()) and (select public.is_org_owner()))
  with check (organization_id is null or organization_id = (select public.user_org_id()));

-- org_members_see_each_other en admin_all_profiles blijven ongewijzigd.

-- -----------------------------------------------------------------------------
-- 3. organizations — policies opschonen + veilige RPC's
-- -----------------------------------------------------------------------------
-- Alle bestaande policies weg (namen bevatten rare spaties/newlines → dynamisch).
do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'organizations'
  loop
    execute format('drop policy if exists %I on public.organizations', r.policyname);
  end loop;
end $$;

-- Invite-codes: standaard lang en willekeurig, en uniek (hoofdletterongevoelig).
alter table public.organizations
  alter column invite_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
create unique index if not exists organizations_invite_code_uniq
  on public.organizations (upper(invite_code)) where invite_code is not null;

create policy orgs_select on public.organizations
  for select to authenticated
  using (
    id = (select public.user_org_id())
    or created_by = (select auth.uid())
    or (select public.is_platform_admin())
  );

-- Aanmaken: alleen als je nog geen org hebt (of platform_admin).
create policy orgs_insert on public.organizations
  for insert to authenticated
  with check (
    (select public.is_platform_admin())
    or ((select public.user_org_id()) is null and created_by = (select auth.uid()))
  );

-- Wijzigen: alleen org_owner van die org of platform_admin.
create policy orgs_update on public.organizations
  for update to authenticated
  using ((id = (select public.user_org_id()) and (select public.is_org_owner())) or (select public.is_platform_admin()))
  with check ((id = (select public.user_org_id()) and (select public.is_org_owner())) or (select public.is_platform_admin()));

-- Verwijderen: alleen platform_admin.
create policy orgs_delete on public.organizations
  for delete to authenticated
  using ((select public.is_platform_admin()));

-- RPC: organisatie aanmaken + jezelf org_owner maken (aanbevolen i.p.v. 2 losse calls)
create or replace function public.create_organization(p_name text)
returns public.organizations
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles;
  v_org public.organizations;
begin
  if v_uid is null then raise exception 'Niet ingelogd' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 200 then
    raise exception 'Ongeldige bedrijfsnaam' using errcode = '22023';
  end if;

  select * into v_prof from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profiel niet gevonden' using errcode = 'P0002'; end if;
  if v_prof.organization_id is not null and v_prof.role <> 'platform_admin' then
    raise exception 'Je bent al lid van een organisatie' using errcode = '42501';
  end if;

  insert into public.organizations (name, plan, created_by)
  values (trim(p_name), 'starter', v_uid)
  returning * into v_org;

  update public.profiles
     set organization_id = v_org.id,
         role = case when role = 'platform_admin' then role else 'org_owner' end
   where id = v_uid;

  return v_org;
end;
$$;

-- RPC: lid worden via invite-code (alleen als je nog geen org hebt) → rol employee
create or replace function public.join_org_by_invite(p_code text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles;
  v_org uuid;
begin
  if v_uid is null then raise exception 'Niet ingelogd' using errcode = '42501'; end if;
  if p_code is null or length(trim(p_code)) < 6 then
    raise exception 'Onbekende uitnodigingscode' using errcode = 'P0002';
  end if;

  select * into v_prof from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profiel niet gevonden' using errcode = 'P0002'; end if;
  if v_prof.organization_id is not null then
    raise exception 'Je bent al lid van een organisatie' using errcode = '42501';
  end if;

  select id into v_org from public.organizations
   where invite_code is not null and upper(invite_code) = upper(trim(p_code));
  if v_org is null then
    raise exception 'Onbekende uitnodigingscode' using errcode = 'P0002';
  end if;

  update public.profiles
     set organization_id = v_org, role = 'employee', access_type = 'meekijk'
   where id = v_uid;

  return v_org;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Financiële tabellen — RESTRICTIVE gate bovenop de bestaande *_org policies
-- -----------------------------------------------------------------------------
-- Bestaande permissive policies (org_id = user_org_id() OR is_platform_admin())
-- blijven staan. Daarbovenop:
--   *_gate_read  : lezen/schrijven alleen met has_finance_access() (geen employees)
--                  + schrijven alleen met can_write_finance() (geen 'meekijk')
--   *_gate_delete: verwijderen alleen met can_write_finance()
-- Org-owner (Paul) en platform_admin houden volledige toegang.
do $$
declare
  t text;
begin
  foreach t in array array[
    'bank_transactions','boek_assets','boek_entries','clients','entities','expenses',
    'horizon_scenarios','invoice_items','invoice_reminders','invoices','org_settings',
    'purchase_invoices','quote_items','quotes','reminder_templates'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', t || '_gate_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_gate_delete', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using ((select public.has_finance_access())) '
      'with check ((select public.can_write_finance()))',
      t || '_gate_read', t);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated '
      'using ((select public.can_write_finance()))',
      t || '_gate_delete', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Publieke onderteken-links — via RPC i.p.v. brede SELECT-policies
-- -----------------------------------------------------------------------------
-- De oude policies lieten anon ALLE offertes/facturen met een sign_token
-- (van alle organisaties, incl. extra-jsonb) uitlezen.
drop policy if exists invoices_public_sign on public.invoices;
drop policy if exists quotes_public_sign on public.quotes;

-- Eén offerte ophalen op token. Geeft alleen wat de klant moet zien.
create or replace function public.get_quote_by_token(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  q public.quotes;
begin
  if p_token is null or length(p_token) < 12 or length(p_token) > 200 then
    return null;
  end if;

  select * into q from public.quotes where sign_token = p_token limit 1;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'number',       q.number,
    'issueDate',    q.issue_date,
    'validUntil',   q.valid_until,
    'status',       q.status,
    'currency',     q.currency,
    'subject',      q.subject,
    'notes',        q.notes,
    'intro',        q.extra->>'intro',
    'subtotal',     q.subtotal,
    'btwTotal',     q.btw_total,
    'total',        q.total,
    'signedAt',     q.signed_at,
    'signedByName', q.signed_by_name,
    'clientName',   (select c.name from public.clients c
                      where c.id = q.client_id and c.org_id = q.org_id),
    'companyName',  coalesce(
                      (select e.name from public.entities e
                        where e.id = q.entity_id and e.org_id = q.org_id),
                      (select s.company_name from public.org_settings s
                        where s.org_id = q.org_id)),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'description', i.description,
               'quantity',    i.quantity,
               'price',       i.unit_price,
               'btwRate',     i.btw_rate,
               'discount',    case when i.discount_type is null then null
                                   else jsonb_build_object('type', i.discount_type,
                                                           'value', i.discount_value,
                                                           'name', i.discount_name) end
             ) order by i.sort_order)
      from (select distinct on (sort_order) *
              from public.quote_items
             where quote_id = q.id
             order by sort_order, id) i
    ), '[]'::jsonb)
  );
end;
$$;

-- Offerte accepteren/afwijzen via token. Eén keer; daarna vergrendeld.
create or replace function public.sign_quote(
  p_token     text,
  p_name      text,
  p_signature text,
  p_status    text default 'accepted'
)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  q      public.quotes;
  v_name text := trim(coalesce(p_name, ''));
  v_ip   text;
  v_now  timestamptz := now();
begin
  if p_token is null or length(p_token) < 12 or length(p_token) > 200 then
    raise exception 'Ongeldige link' using errcode = 'P0002';
  end if;
  -- (NULL-check expliciet: `null not in (...)` is NULL → zou anders status = NULL wegschrijven)
  if p_status is null or p_status not in ('accepted', 'declined') then
    raise exception 'Ongeldige status' using errcode = '22023';
  end if;
  if length(v_name) = 0 or length(v_name) > 200 then
    raise exception 'Naam is verplicht (max 200 tekens)' using errcode = '22023';
  end if;
  if p_status = 'accepted' then
    if p_signature is null
       or p_signature not like 'data:image/png;base64,%'
       or length(p_signature) > 300000 then
      raise exception 'Ongeldige handtekening' using errcode = '22023';
    end if;
  elsif p_signature is not null then
    raise exception 'Geen handtekening bij afwijzen' using errcode = '22023';
  end if;

  select * into q from public.quotes where sign_token = p_token for update;
  if not found then
    raise exception 'Offerte niet gevonden' using errcode = 'P0002';
  end if;
  if q.signed_at is not null or q.status in ('accepted', 'declined', 'converted') then
    raise exception 'Deze offerte is al verwerkt' using errcode = '42501';
  end if;
  if q.valid_until is not null and q.valid_until < current_date then
    raise exception 'Deze offerte is verlopen' using errcode = '42501';
  end if;

  begin
    v_ip := left(split_part(
              coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''),
              ',', 1), 64);
  exception when others then
    v_ip := null;
  end;

  update public.quotes
     set status         = p_status,
         signed_at      = v_now,
         signed_by_name = v_name,
         signed_by_ip   = nullif(trim(v_ip), ''),
         extra          = coalesce(extra, '{}'::jsonb)
                          || jsonb_build_object(
                               'signatureData', p_signature,
                               'signerName',    v_name,
                               'history', coalesce(extra->'history', '[]'::jsonb)
                                          || jsonb_build_array(jsonb_build_object(
                                               'status', p_status, 'at', v_now,
                                               'by', v_name, 'via', 'public_link')))
   where id = q.id;

  return jsonb_build_object('status', p_status, 'signedAt', v_now, 'signedByName', v_name);
end;
$$;

-- (Facturen worden in de app niet publiek ondertekend → geen invoice-RPC;
--  alleen de brede policy is verwijderd.)

-- -----------------------------------------------------------------------------
-- 6. user_settings — per-gebruiker instellingen (AI-keys, import-token)
-- -----------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid references public.organizations(id) on delete set null,
  data       jsonb not null default '{}'::jsonb,
  api_token  text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_api_token_len check (api_token is null or length(api_token) >= 32)
);

alter table public.user_settings enable row level security;

-- Import-token: alleen de SHA-256-hash (hex) wordt bewaard, nooit het token zelf.
-- De edge function import-invoice hasht het binnenkomende Bearer-token en zoekt op deze kolom.
alter table public.user_settings add column if not exists api_token text;  -- legacy, blijft leeg
alter table public.user_settings add column if not exists api_token_hash text;
alter table public.user_settings drop constraint if exists user_settings_api_token_hash_fmt;
alter table public.user_settings
  add constraint user_settings_api_token_hash_fmt
  check (api_token_hash is null or api_token_hash ~ '^[0-9a-f]{64}$');
create unique index if not exists user_settings_api_token_hash_uniq
  on public.user_settings (api_token_hash) where api_token_hash is not null;

-- Bestaande plaintext-tokens omzetten naar hash (Make-koppelingen blijven werken) en wissen.
update public.user_settings
   set api_token_hash = encode(sha256(convert_to(api_token, 'UTF8')), 'hex'),
       api_token      = null
 where api_token is not null;

-- org_id NOOIT door de client te kiezen: altijd de eigen (actieve) org.
-- Anders kan iemand via de import-invoice edge function inkoopfacturen in
-- een andere organisatie injecteren.
create or replace function public.user_settings_force_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.user_id   := auth.uid();
    new.org_id    := public.user_org_id();
    new.api_token := null;  -- plaintext-token nooit opslaan; alleen api_token_hash
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_settings_force_org on public.user_settings;
create trigger trg_user_settings_force_org
  before insert or update on public.user_settings
  for each row execute function public.user_settings_force_org();

drop policy if exists user_settings_select_own on public.user_settings;
drop policy if exists user_settings_insert_own on public.user_settings;
drop policy if exists user_settings_update_own on public.user_settings;
drop policy if exists user_settings_delete_own on public.user_settings;

create policy user_settings_select_own on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_settings_insert_own on public.user_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_settings_update_own on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_settings_delete_own on public.user_settings
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.user_settings from anon;
grant select, insert, update, delete on public.user_settings to authenticated;
-- (api_token_hash-lookup gebeurt server-side in de edge function met service_role.)

-- -----------------------------------------------------------------------------
-- 7. EXECUTE-rechten aanscherpen
-- -----------------------------------------------------------------------------
-- Trigger-/event-functies: niemand hoeft ze direct aan te roepen.
revoke execute on function public.handle_new_user()            from public, anon, authenticated;
revoke execute on function public.set_updated_at()             from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()            from public, anon, authenticated;
revoke execute on function public.profiles_guard_privileged()  from public, anon, authenticated;
revoke execute on function public.user_settings_force_org()    from public, anon, authenticated;

-- RLS-helpers: nodig voor 'authenticated' (policies roepen ze aan), niet voor anon.
revoke execute on function public.is_platform_admin()   from public, anon;
revoke execute on function public.user_org_id()         from public, anon;
revoke execute on function public.is_org_owner()        from public, anon;
revoke execute on function public.has_finance_access()  from public, anon;
revoke execute on function public.can_write_finance()   from public, anon;
revoke execute on function public.org_created_by(uuid)  from public, anon, authenticated;
grant  execute on function public.is_platform_admin()   to authenticated;
grant  execute on function public.user_org_id()         to authenticated;
grant  execute on function public.is_org_owner()        to authenticated;
grant  execute on function public.has_finance_access()  to authenticated;
grant  execute on function public.can_write_finance()   to authenticated;
-- org_created_by wordt alleen in de guard-trigger gebruikt, die als
-- 'authenticated' draait → die rol heeft EXECUTE nodig.
grant  execute on function public.org_created_by(uuid)  to authenticated;

-- RPC's voor ingelogde gebruikers
revoke execute on function public.create_organization(text)  from public, anon;
revoke execute on function public.join_org_by_invite(text)   from public, anon;
grant  execute on function public.create_organization(text)  to authenticated;
grant  execute on function public.join_org_by_invite(text)   to authenticated;

-- Publieke onderteken-RPC's (anon = klant zonder account)
revoke execute on function public.get_quote_by_token(text)            from public;
revoke execute on function public.sign_quote(text, text, text, text)  from public;
grant  execute on function public.get_quote_by_token(text)            to anon, authenticated;
grant  execute on function public.sign_quote(text, text, text, text)  to anon, authenticated;

commit;

-- =============================================================================
-- Controle na uitvoeren (los draaien):
--   select policyname, cmd, permissive, roles from pg_policies
--    where schemaname='public' and tablename in ('profiles','organizations','quotes','user_settings');
--   select public.get_quote_by_token('<een bestaande sign_token>');
-- In de app (als Paul): facturen/offertes/bank laden en opslaan moet gewoon werken.
-- Test escalatie (als normale gebruiker, via supabase-js):
--   supabase.from('profiles').update({ role: 'platform_admin' }).eq('id', user.id)
--   → moet falen met "Je kunt je eigen rol/organisatie niet wijzigen".
-- =============================================================================
