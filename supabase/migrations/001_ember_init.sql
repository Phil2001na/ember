-- Ember v1 schema — everything lives inside the `ember` schema.
-- Shared Supabase project: never touches public/trim/egg/solarize.

create schema if not exists ember;

-- ─── tables ─────────────────────────────────────────────────────

create table ember.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  skill_level text not null default 'beginner'
    check (skill_level in ('beginner', 'comfortable', 'confident')),
  dietary_notes text,
  created_at timestamptz not null default now()
);

create table ember.equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unique (user_id, name)
);

create table ember.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity_text text,
  source text not null default 'manual' check (source in ('photo', 'manual')),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table ember.cook_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe jsonb not null,
  messages jsonb not null default '[]'::jsonb,
  current_step int not null default 0,
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index cook_sessions_user_status_idx on ember.cook_sessions (user_id, status);

create table ember.explore_dishes (
  id uuid primary key default gen_random_uuid(),
  dish jsonb not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── RLS: users own their rows; explore is read-only shared ────

alter table ember.profiles enable row level security;
alter table ember.equipment enable row level security;
alter table ember.pantry_items enable row level security;
alter table ember.cook_sessions enable row level security;
alter table ember.explore_dishes enable row level security;

create policy ember_profiles_own on ember.profiles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy ember_equipment_own on ember.equipment
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy ember_pantry_own on ember.pantry_items
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy ember_sessions_own on ember.cook_sessions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy ember_explore_read on ember.explore_dishes
  for select to authenticated
  using (true);
-- writes to explore_dishes happen server-side (service role) only

-- ─── grants ─────────────────────────────────────────────────────

grant usage on schema ember to authenticated, service_role;
grant all on all tables in schema ember to authenticated, service_role;
alter default privileges in schema ember
  grant all on tables to authenticated, service_role;

-- ─── updated_at maintenance ────────────────────────────────────

create or replace function ember.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger pantry_touch before update on ember.pantry_items
  for each row execute function ember.touch_updated_at();

-- ─── storage: private per-user pantry photos ───────────────────

insert into storage.buckets (id, name, public)
values ('ember', 'ember', false)
on conflict (id) do nothing;

create policy ember_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ember' and (storage.foldername(name))[1] = auth.uid()::text);

create policy ember_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'ember' and (storage.foldername(name))[1] = auth.uid()::text);

create policy ember_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ember' and (storage.foldername(name))[1] = auth.uid()::text);
