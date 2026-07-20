-- Planned meals: "I want to make X" — Ember works out the real ingredient
-- list, checks it against the pantry, and the cook can send the missing
-- bits to the shopping list and come back to start cooking later.

create table ember.planned_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  ingredients jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table ember.planned_meals enable row level security;

create policy ember_planned_meals_own on ember.planned_meals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on ember.planned_meals to authenticated, service_role;
