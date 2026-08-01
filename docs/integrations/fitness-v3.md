# Fitness ↔ Ember — V3: the standing link

V1 and V2 (see `fitness-v1.md`, `fitness-v2.md`, both still supported) only ever
close the loop for a cook that *started* from a Fitness nudge — the "I ate this"
return trip is keyed off a `request_id` that only exists because Fitness handed
it to Ember in the first place. Cook something you picked yourself, inside Ember
directly, and there was nothing to send it back with.

V3 adds a standing connection so **any** finished cook can log to Fitness, not
just ones Fitness asked for.

## What changed on Ember's side (done, this repo)

- `ember.profiles.fitness_auto_log` (migration `005_fitness_auto_log.sql`) — a
  per-user opt-in flag, off by default. Toggled from Settings
  (`components/FitnessConnection.tsx`).
- `POST /api/nutrition/log` — session-authenticated (reads the caller's own
  Supabase session, not a shared secret). Looks up the *actual* finished
  `cook_sessions` row for the caller (RLS-scoped, so a stray id 404s rather
  than leaking someone else's cook), infers the outcome from the recipe that
  was really cooked (`inferMealOutcome`, same function V1/V2 already use), and
  — only if `fitness_auto_log` is on — relays it to Fitness server-to-server.
- The finish-cook screen (`CookClient.tsx`) now shows an "I ate this" card
  whenever `fitness_auto_log` is on, even with no `request_id` in play. Unlike
  V1/V2 this doesn't navigate the browser to Fitness — it's a background POST,
  and the card just flips to a "Logged to Fitness" checkmark in place.
- Cooks that *did* start from a Fitness nudge keep using the existing V1/V2
  browser-redirect flow unchanged — this is additive, not a replacement.

Note the security shape is deliberately better than V1/V2 here: the shared
secret never reaches the browser, and there's no `request_id` traveling in a
URL to forge, because the caller is authenticated by their own Ember session
and the request_id Ember generates never leaves the server-to-server call.

## What Fitness still needs to implement

**`POST {FITNESS_URL}/api/nutrition/log`**
Header: `x-integration-secret: <shared secret>` — a **new** secret, not the
one V2's `/api/nutrition/suggest` uses. Store it as `EMBER_FITNESS_LOG_SECRET`
on both sides (Ember env + Fitness env, same value).

```jsonc
{
  "v": 2,
  "ember_user_id": "uuid",     // same id already used for the nudge machine call
  "request_id": "uuid",        // fresh per call, for idempotency — Fitness should
                                // still honor the (user_id, request_id) unique index
  "eaten": true,
  "size": "snack" | "light_meal" | "full_meal",
  "protein_anchor": true,
  "confidence": "low" | "medium" | "high",
  "kcal": 620,
  "protein_g": 34,
  "title": "Boerewors with buttery mash"
}
```

Fitness already stores an `ember_user_id → fitness user` mapping (it's what
makes the existing `/api/nutrition/suggest` nudge call work), so this endpoint
resolves the same way — no new pairing UI needed on Fitness's side. It should
write one `fitness.food_entries` row keyed by `(user_id, request_id)`, same
table and same idempotency the V2 browser return already uses.

Response: `200` on success. Any non-2xx is treated by Ember as a soft failure
— the user sees "Couldn't reach Fitness — try again" and can retry; nothing
else in Ember breaks.

Until this endpoint exists, Ember's `/api/nutrition/log` returns `502
fitness-rejected` (or `fitness-unreachable`) and the Settings toggle simply
does nothing effective — the toggle itself is safe to ship ahead of the
Fitness-side work.

## Environment (new)

| Variable | Where | Purpose |
|---|---|---|
| `EMBER_FITNESS_LOG_SECRET` | Ember | header value sent to Fitness's new log endpoint |
| `EMBER_FITNESS_LOG_SECRET` | Fitness | must equal the above; gates the new endpoint |

(In addition to the V2 variables in `fitness-v2.md`, which are unchanged.)
