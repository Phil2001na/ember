-- Fitness → Ember, V4: reserve a recipe at planning time, not just cook time.
-- See docs/integrations/fitness-v4.md.

create table ember.fitness_reserved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish text not null,
  slot text,
  recipe jsonb not null,
  kcal_estimate int not null,
  protein_g_estimate int not null,
  time_minutes int not null,
  needs_cooking boolean not null default true,
  why text,
  -- pantry item names at reservation time, so the cook-it side can tell
  -- whether the pantry has materially changed since planning (see contract's
  -- staleness note).
  pantry_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  opened_at timestamptz
);

create index fitness_reserved_recipes_user_idx on ember.fitness_reserved_recipes (user_id);

alter table ember.fitness_reserved_recipes enable row level security;

-- The browser reads its own reservations under the caller's own (anonymous)
-- session — this is what scopes `recipe_id` lookups to the kitchen that
-- reserved it (contract's trust-boundary note): a guessed id from another
-- kitchen just won't match auth.uid() and comes back empty.
create policy ember_fitness_reserved_recipes_own on ember.fitness_reserved_recipes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on ember.fitness_reserved_recipes to authenticated, service_role;

-- ─── machine insert: Fitness → Ember reserve call ──────────────────
-- Mirrors ember_pantry_for_integration's shape: SECURITY DEFINER, gated by
-- the same shared secret (fitness.check_secret('integration', ...)), and
-- callable by the anon role because the caller (Fitness) has no Ember
-- session of its own.
create or replace function public.ember_reserve_recipe_for_integration(
  p_secret text,
  p_user_id uuid,
  p_dish text,
  p_slot text,
  p_recipe jsonb,
  p_kcal_estimate int,
  p_protein_g_estimate int,
  p_time_minutes int,
  p_needs_cooking boolean,
  p_why text,
  p_pantry_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not fitness.check_secret('integration', p_secret) then
    raise exception 'forbidden' using errcode = '28000';
  end if;

  -- Lazy GC: a reservation nobody opens is inert, not a leak, but it
  -- shouldn't pile up forever (contract's lifecycle note) — swept for this
  -- user on each new reserve rather than needing a standalone cron job.
  delete from ember.fitness_reserved_recipes
  where user_id = p_user_id
    and opened_at is null
    and created_at < now() - interval '4 days';

  insert into ember.fitness_reserved_recipes (
    user_id, dish, slot, recipe, kcal_estimate, protein_g_estimate,
    time_minutes, needs_cooking, why, pantry_snapshot
  ) values (
    p_user_id, p_dish, p_slot, p_recipe, p_kcal_estimate, p_protein_g_estimate,
    p_time_minutes, p_needs_cooking, p_why, p_pantry_snapshot
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ember_reserve_recipe_for_integration(
  text, uuid, text, text, jsonb, int, int, int, boolean, text, jsonb
) from public;
grant execute on function public.ember_reserve_recipe_for_integration(
  text, uuid, text, text, jsonb, int, int, int, boolean, text, jsonb
) to anon, service_role;
