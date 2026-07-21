-- Public recipe links are immutable snapshots, separate from private saved recipes.
-- The random UUID is the capability: only someone with the link can fetch the snapshot.

create table ember.recipe_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_recipe_id uuid not null references ember.saved_recipes(id) on delete cascade,
  recipe jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, saved_recipe_id)
);

alter table ember.recipe_shares enable row level security;

create policy ember_recipe_shares_own on ember.recipe_shares
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on ember.recipe_shares to authenticated, service_role;

-- Do not grant public table reads. This function returns only the single snapshot
-- addressed by an unguessable UUID and reveals no owner metadata.
create or replace function ember.get_shared_recipe(p_share_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select recipe
  from ember.recipe_shares
  where id = p_share_id
$$;

revoke all on function ember.get_shared_recipe(uuid) from public;
grant execute on function ember.get_shared_recipe(uuid) to authenticated;
