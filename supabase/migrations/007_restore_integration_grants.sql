-- ─── restore EXECUTE on the two Fitness-integration RPCs ───
--
-- Found 2026-08-06: `/api/nutrition/reserve` returned
-- `permission denied for function ember_pantry_for_integration`, and
-- `/api/nutrition/suggest` (V2) was failing the same way — which meant the
-- Guided Training nudge loop had no food brain at all.
--
-- Cause: `lib/supabase/machine.ts` deliberately holds only **anon** rights;
-- the elevation happens inside these SECURITY DEFINER functions, gated by the
-- shared secret. So `anon` must hold EXECUTE on both. It had stopped doing so:
--
--   * `ember_pantry_for_integration` never had an explicit grant — it relied on
--     the default EXECUTE-to-PUBLIC that Postgres gives new functions, which a
--     later `revoke ... from public` took away.
--   * `ember_reserve_recipe_for_integration` (migration 006) does revoke from
--     PUBLIC and then grant to `anon`, but only the revoke made it to the live
--     database.
--
-- Granting to a named role instead of leaning on PUBLIC is the durable fix:
-- a future `revoke ... from public` can no longer silently disarm these.
--
-- `ember_pantry_for_integration` is recreated here verbatim from its live
-- definition because it had never been captured in a migration at all — it was
-- applied ad hoc during the V2 work, so the repo did not describe production.
-- The signature is unchanged, so this replace preserves grants rather than
-- resetting them.

create or replace function public.ember_pantry_for_integration(p_secret text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not fitness.check_secret('integration', p_secret) then raise exception 'forbidden' using errcode = '28000'; end if;
  return jsonb_build_object(
    'pantry', coalesce((select jsonb_agg(jsonb_build_object('item', i.name, 'qty', i.quantity_text)) from ember.pantry_items i where i.user_id = p_user_id), '[]'::jsonb),
    'equipment', coalesce((select jsonb_agg(e.name) from ember.equipment e where e.user_id = p_user_id), '[]'::jsonb),
    'profile', (select to_jsonb(p) from ember.profiles p where p.user_id = p_user_id)
  );
end; $function$;

revoke all on function public.ember_pantry_for_integration(text, uuid) from public;
grant execute on function public.ember_pantry_for_integration(text, uuid)
  to anon, authenticated, service_role;

grant execute on function public.ember_reserve_recipe_for_integration(
  text, uuid, text, text, jsonb, int, int, int, boolean, text, jsonb
) to anon, authenticated, service_role;
