-- Cook feedback is a deliberate, per-session signal. It improves future suggestions
-- without treating one meal as a permanent preference.

create table ember.cook_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cook_session_id uuid not null references ember.cook_sessions(id) on delete cascade,
  would_cook_again boolean not null,
  signals text[] not null default '{}'
    check (signals <@ array['too_spicy', 'took_too_long', 'loved_it']::text[]),
  note text check (note is null or char_length(trim(note)) between 2 and 280),
  created_at timestamptz not null default now(),
  unique (user_id, cook_session_id)
);

create index cook_feedback_user_created_idx
  on ember.cook_feedback (user_id, created_at desc);

alter table ember.cook_feedback enable row level security;

create policy ember_cook_feedback_own on ember.cook_feedback
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant all on ember.cook_feedback to authenticated, service_role;
