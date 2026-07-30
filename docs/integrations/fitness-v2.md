# Fitness ↔ Ember — V2 contract

V1 (see `fitness-v1.md`, still supported) was a number-free URL handoff started by
a person tapping a button. V2 adds the two things the nutrition loop needs:

1. **A machine-to-machine call.** Fitness can ask Ember for food with nobody
   looking at a screen, which is what makes scheduled reminders possible.
2. **Rough energy figures.** The ledger needs numbers. They are explicitly rough
   and always described as "about" in the UI.

Ownership is unchanged: **Fitness never receives pantry contents** — only dishes
that came out of the pantry. **Ember never decides a body target** and never
mentions calories to the user.

## 1. Machine call — Fitness → Ember

`POST {EMBER_URL}/api/nutrition/suggest`
Header: `x-integration-secret: <shared secret>`

```jsonc
{
  "v": 2,
  "ember_user_id": "uuid",   // which kitchen (Ember uses anonymous auth)
  "goal": "gain" | "maintain" | "lighter",
  "kcal_target": 800,        // roughly how big this meal should be
  "protein_target_g": 45,
  "slot": "breakfast" | "lunch" | "dinner" | "..._snack" | "catchup",
  "time_minutes": 40,
  "urgency": "easy" | "steady" | "behind" | "catchup"
}
```

Response:

```jsonc
{
  "suggestions": [{
    "title": "Boerewors with buttery mash",
    "description": "…",
    "kcal_estimate": 820, "protein_g_estimate": 42,
    "time_minutes": 35, "needs_cooking": true,
    "why": "…"
  }],
  "lazy_option": { /* same shape, needs_cooking: false */ }
}
```

`lazy_option` is mandatory and load-bearing: for putting weight on, the no-cook
option someone will actually take at 9pm beats the ideal meal they won't cook.

Failure modes are all soft — `empty-pantry` returns 200 with no suggestions, and
any error leaves Fitness to fall back to its own static lazy option. A reminder
never fails to arrive just because Ember is down.

Elevated pantry reads happen inside `public.ember_pantry_for_integration(secret,
user_id)`, a `SECURITY DEFINER` RPC. **Only Ember's server calls it** — that is
what keeps the pantry on Ember's side of the boundary. No service-role key is
used anywhere in this integration.

## 2. Cook handoff — Fitness → Ember (browser)

`GET {EMBER_URL}/from/fitness` with the V1 parameters plus:

| param            | values                                        |
|------------------|-----------------------------------------------|
| `v`              | `2`                                            |
| `kcal_target`    | 50–3000                                        |
| `protein_target` | 0–300                                          |
| `dish`           | dish already chosen in Fitness — Ember skips its own suggestions and goes straight to the recipe |
| `nudge_id`       | uuid of the originating nudge                  |

Ember stores `kcal_target`/`protein_target` in `localStorage` under
`ember-fitness-hint-<cookSessionId>` so the return trip can carry numbers.

## 3. Return — Ember → Fitness (browser)

`GET {FITNESS_URL}/nutrition/ember` with the V1 parameters plus:

| param       | values                          |
|-------------|---------------------------------|
| `v`         | `2`                              |
| `kcal`      | 0–6000, rough                    |
| `protein_g` | 0–500, rough                     |
| `title`     | the dish actually cooked         |

Fitness writes one `fitness.food_entries` row keyed by `request_id`. A partial
unique index on `(user_id, request_id)` makes replays — refresh, back button,
re-opened link — idempotent.

Ember does not compute nutrition. It returns the figure Fitness asked for,
which honestly means "roughly the meal you asked for"; confidence drops to `low`
when there was no hint to echo.

## Trust boundary

Unchanged from V1 and still the main thing to fix before this is more than a
personal tool: `request_id` travels in a URL and a return can be forged. The
machine call is stronger (a shared secret in a header, not a query parameter),
but the secret is long-lived. Before this serves anyone but its author, replace
both with short-lived, single-use, server-issued tokens.

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_EMBER_URL` | Fitness | allowlisted Ember base |
| `EMBER_INTEGRATION_SECRET` | Fitness | machine call header |
| `FITNESS_INTEGRATION_SECRET` | Ember | must equal the above |
| `NEXT_PUBLIC_FITNESS_URL` | Ember | allowlisted return base |
| `FITNESS_CRON_SECRET` | Fitness | gates `/api/cron/nudge` |

Both secrets are also stored in `fitness.integration_secrets` (keys `integration`
and `cron`), which is where the SQL-side checks read them from.
