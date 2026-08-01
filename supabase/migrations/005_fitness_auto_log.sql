-- Standing Ember ↔ Fitness link (see docs/integrations/fitness-v3.md).
-- Lets a finished cook log to Fitness even when it didn't start from a
-- Fitness nudge — gated by this per-user opt-in flag.

alter table ember.profiles
  add column if not exists fitness_auto_log boolean not null default false;
