-- Saved recipes: cooks can bookmark a finished recipe to revisit later.

create table ember.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe jsonb not null,
  saved_at timestamptz not null default now()
);

alter table ember.saved_recipes enable row level security;

create policy ember_saved_recipes_own on ember.saved_recipes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on ember.saved_recipes to authenticated, service_role;
