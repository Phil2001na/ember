-- Ember's durable kitchen memory. Keep it explicit, per-user and fully editable:
-- recent home-chat turns for continuity, plus only preferences Ember was asked to remember.

create table ember.kitchen_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);

create index kitchen_messages_user_created_idx
  on ember.kitchen_messages (user_id, created_at desc);

create table ember.kitchen_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 2 and 280),
  created_at timestamptz not null default now(),
  unique (user_id, text)
);

create index kitchen_preferences_user_created_idx
  on ember.kitchen_preferences (user_id, created_at desc);

alter table ember.kitchen_messages enable row level security;
alter table ember.kitchen_preferences enable row level security;

create policy ember_kitchen_messages_own on ember.kitchen_messages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy ember_kitchen_preferences_own on ember.kitchen_preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant all on ember.kitchen_messages, ember.kitchen_preferences to authenticated, service_role;
