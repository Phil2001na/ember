-- Shopping list: what to buy, checked off while shopping, moved to pantry when done.

create table ember.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity_text text,
  reason text,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table ember.shopping_items enable row level security;

create policy ember_shopping_own on ember.shopping_items
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on ember.shopping_items to authenticated, service_role;
