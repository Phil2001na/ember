-- claim_handle failed with "duplicate key value violates unique constraint
-- equipment_user_id_name_key" the first time it ran for real: the fresh
-- device already had a couple of equipment rows from onboarding (same names
-- as the account being claimed), and moving the old owner's equipment onto
-- v_uid collided with them. pantry_items and shopping_items have the same
-- unique(user_id, name) shape and would fail the same way.
--
-- The existing guard already refuses the claim if v_uid has real pantry
-- items, so anything else sitting on v_uid at that point is just onboarding
-- scraps — safe to clear before moving the old owner's rows in.
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

  -- Clear onboarding scraps on this device so the move below can't collide
  -- with them (equipment/pantry_items/shopping_items are unique on
  -- (user_id, name)).
  delete from ember.equipment      where user_id = v_uid;
  delete from ember.shopping_items where user_id = v_uid;
  delete from ember.recipe_shares  where user_id = v_uid;
  delete from ember.saved_recipes  where user_id = v_uid;
  delete from ember.planned_meals  where user_id = v_uid;
  delete from ember.cook_sessions  where user_id = v_uid;
  delete from ember.profiles       where user_id = v_uid;

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
