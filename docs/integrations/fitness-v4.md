# Fitness ↔ Ember — V4: reserve a recipe at planning time

V1-V3 (see `fitness-v1.md`, `fitness-v2.md`, `fitness-v3.md`, all still supported) only ever
generate a recipe at the moment someone taps "cook it" — even a meal planned the night before
still triggers fresh generation the next morning. V4 lets Fitness lock in the dish at planning
time and have Ember write the actual recipe right then, so the day-of "cook it" opens a ready
recipe instead of generating one from scratch.

Ownership is unchanged: **Fitness never learns pantry contents**, **Ember never decides a body
target**.

## 1. Reserve — Fitness → Ember (machine call, new)

`POST {EMBER_URL}/api/nutrition/reserve`
Header: `x-integration-secret: <shared secret>` — same secret and same trust class as
`/api/nutrition/suggest` (V2), not a new one.

```jsonc
{
  "v": 1,
  "ember_user_id": "uuid",
  "dish": "Boerewors with buttery mash",  // the exact suggestion being locked in — generate
                                           // this dish, not a fresh ask
  "kcal_target": 820,
  "protein_target_g": 42,
  "time_minutes": 35,
  "slot": "breakfast" | "lunch" | "dinner" | "..._snack"
}
```

Response `200`:

```jsonc
{
  "recipe_id": "uuid",
  "title": "Boerewors with buttery mash",
  "description": "…",
  "kcal_estimate": 820,
  "protein_g_estimate": 42,
  "time_minutes": 35,
  "needs_cooking": true,
  "why": "…"
}
```

Ember writes the full recipe from the real pantry right away (same engine `/api/recipe` already
uses, but told exactly what dish to produce instead of asked to pick one) and persists it keyed
by `recipe_id`, scoped to `ember_user_id`. The numbers in the response are a pantry-accurate
version of the same dish and may drift slightly from the request — expected, and Fitness stores
whatever comes back.

Failure is not soft here, unlike `/suggest`: an **empty pantry returns `422`**, and a model
failure after retrying the other provider returns `502`. Fitness treats any non-200 (or a
timeout) as "reservation failed" and just saves the plan without a recipe reference — a fast,
loud failure beats a low-quality guess written under time pressure.

## 2. Cook it — Fitness → Ember (browser), extends `/from/fitness`

`/from/fitness` keeps all its V1/V2 query params (`v=2`, `request_id`, `goal`, `need`, `dish`,
`kcal_target`, `protein_target`, `nudge_id`, …) and gains one new **optional** one:

| param       | values                                                                       |
|-------------|-------------------------------------------------------------------------------|
| `recipe_id` | uuid from step 1 — when present, skip suggestion/generation entirely and open this exact recipe |

`request_id` is still minted fresh by Fitness at the moment "Cook it" is tapped — it identifies
this cook-and-return round trip. `recipe_id` identifies *what* to cook and is independent of it;
the same reserved recipe can be opened more than once before it's actually eaten.

**The return trip is unchanged.** `GET {FITNESS_URL}/nutrition/ember?v=2&request_id=...&eaten=...`
etc. still fires exactly as it does today — reservation only changes what Ember shows when the
browser lands on `/from/fitness`, not what gets reported back.

## Where this lives on Ember's side

- `ember.fitness_reserved_recipes` (migration `006_fitness_reserved_recipes.sql`) — one row per
  reservation: the full `Recipe` (title/ingredients/steps/…), the summary numbers returned to
  Fitness, the requested slot, a snapshot of pantry item names at reservation time, and
  `opened_at` (null until first opened).
- `public.ember_reserve_recipe_for_integration` — `SECURITY DEFINER` RPC, gated by the same
  `fitness.check_secret('integration', …)` check `ember_pantry_for_integration` uses. This is
  what lets the secret-gated route (which has no Ember session) write the row.
- `POST /api/nutrition/reserve` — the machine route above. Reuses `ember_pantry_for_integration`
  for the pantry read, generates the recipe with `brain` (falling back to `spareBrain`, same as
  `/api/nutrition/suggest`), and calls the RPC to persist it.
- `GET /api/nutrition/reserved/[id]` — session-authenticated (the caller's own anonymous Ember
  session, not the shared secret). RLS on `fitness_reserved_recipes` (`auth.uid() = user_id`) is
  what scopes a `recipe_id` lookup to the kitchen that reserved it — the trust boundary the
  contract calls out, satisfied by the same mechanism V3 already uses for its own session-scoped
  route. Marks `opened_at` on first read.
- `/from/fitness` (`FromFitnessClient.tsx`) — when `recipe_id` is present, fetches the reserved
  recipe from the route above instead of calling `/api/recipe`. If the pantry's item set has
  changed since the snapshot was taken, shows a small "pantry's changed since this was planned"
  notice with a way to regenerate fresh from `dish` instead of silently swapping the recipe out
  from under someone who was told exactly what they'd be making. If the reservation is missing
  or not this kitchen's, falls back to the normal `dish` flow rather than dead-ending.

### Staleness

Presence, not quantity, is the signal: the pantry snapshot is just the list of item names at
reservation time, compared against the current list. An ingredient that's gone (or newly added)
trips the notice; a quantity that dropped does not. Serving the reserved recipe anyway is always
allowed — nothing about it becomes unsafe, just possibly inaccurate.

### Lifecycle

A reservation nobody opens is inert, not a leak. `ember_reserve_recipe_for_integration` sweeps
each user's own unopened reservations older than 4 days every time a new one is written for that
user — no standalone cron needed. Fitness cancelling a plan does not call Ember to release the
reservation; that's an accepted gap, same as the contract describes.

## Environment

No new variables. `/api/nutrition/reserve` reuses `FITNESS_INTEGRATION_SECRET`, the same value
`/api/nutrition/suggest` already checks.
