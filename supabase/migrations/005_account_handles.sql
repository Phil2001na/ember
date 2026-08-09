-- ─── getting back into your own kitchen, without an inbox ───
--
-- The account behind the kitchen is anonymous: it lives in one browser cookie
-- and nothing else, so losing the cookie loses the pantry, saved recipes,
-- everything. Email works but is heavy. This is the light version: attach a
-- name and a secret to the account. Any fresh anonymous session can hand over
-- the name and secret and have the old kitchen moved onto it.
--
-- Same shape as Guided Training's fitness.account_keys / fitness_claim_handle
-- — deliberately, so the two apps recover the same way. Functions live in the
-- `ember` schema itself (not `public`) because the client is schema-scoped to
-- `ember`, unlike Fitness's public-RPC-only setup.

create table if not exists ember.account_keys (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  handle      text not null,
  secret_hash text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Names are matched case-insensitively: "Philip" and "philip" are one account.
create unique index if not exists account_keys_handle_key
  on ember.account_keys (lower(handle));

-- `ember` is exposed to PostgREST and grants `all` on its tables to
-- `authenticated` by default (see 001_ember_init.sql) — RLS with zero
-- policies is what actually stops anyone reading secret_hash directly. Only
-- the security-definer functions below can touch this table.
alter table ember.account_keys enable row level security;

-- ─── name this kitchen ───
create or replace function ember.set_handle(p_handle text, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_handle text := lower(trim(p_handle));
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if v_handle !~ '^[a-z0-9][a-z0-9 ._-]{1,30}$' then
    raise exception 'A name of 2-31 letters, numbers, spaces, dots, dashes or underscores.'
      using errcode = '22023';
  end if;
  if length(coalesce(p_secret, '')) < 6 then
    raise exception 'The secret needs at least 6 characters.' using errcode = '22023';
  end if;

  if exists (
    select 1 from ember.account_keys k
    where lower(k.handle) = v_handle and k.user_id <> v_uid
  ) then
    raise exception 'That name is taken on this app — pick another.' using errcode = '23505';
  end if;

  insert into ember.account_keys as k (user_id, handle, secret_hash)
  values (v_uid, trim(p_handle), extensions.crypt(p_secret, extensions.gen_salt('bf')))
  on conflict (user_id) do update
    set handle = excluded.handle,
        secret_hash = excluded.secret_hash,
        updated_at = now();

  return jsonb_build_object('handle', trim(p_handle));
end;
$$;

-- ─── take the kitchen back ───
-- Moves every ember row from the named account onto the caller's account, so
-- a lost cookie costs a re-entry of two fields rather than the whole kitchen.
create or replace function ember.claim_handle(p_handle text, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_moved int := 0;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  select k.user_id into v_owner
  from ember.account_keys k
  where lower(k.handle) = lower(trim(p_handle))
    and k.secret_hash = extensions.crypt(p_secret, k.secret_hash);

  -- One message for both failures, so this can't be used to find out which
  -- names exist.
  if v_owner is null then
    raise exception 'That name and secret don''t match.' using errcode = '28000';
  end if;

  if v_owner = v_uid then
    return jsonb_build_object('moved', 0, 'already_yours', true);
  end if;

  -- Refuse to bury a kitchen that's actually stocked on this device.
  if exists (select 1 from ember.pantry_items p where p.user_id = v_uid) then
    raise exception 'This device already has a pantry stocked — nothing was moved.'
      using errcode = '23505';
  end if;

  delete from ember.profiles p where p.user_id = v_uid;

  update ember.profiles       set user_id = v_uid where user_id = v_owner;
  get diagnostics v_moved = row_count;
  update ember.equipment      set user_id = v_uid where user_id = v_owner;
  update ember.pantry_items   set user_id = v_uid where user_id = v_owner;
  update ember.cook_sessions  set user_id = v_uid where user_id = v_owner;
  update ember.saved_recipes  set user_id = v_uid where user_id = v_owner;
  update ember.shopping_items set user_id = v_uid where user_id = v_owner;
  update ember.planned_meals  set user_id = v_uid where user_id = v_owner;
  update ember.recipe_shares  set user_id = v_uid where user_id = v_owner;

  update ember.account_keys set user_id = v_uid, updated_at = now() where user_id = v_owner;

  return jsonb_build_object('moved', v_moved, 'from', v_owner);
end;
$$;

-- ─── is this kitchen named yet? ───
create or replace function ember.my_handle()
returns text
language sql
security definer
set search_path = ''
as $$
  select k.handle from ember.account_keys k where k.user_id = auth.uid();
$$;

grant execute on function ember.set_handle(text, text)   to authenticated;
grant execute on function ember.claim_handle(text, text) to authenticated;
grant execute on function ember.my_handle()               to authenticated;
