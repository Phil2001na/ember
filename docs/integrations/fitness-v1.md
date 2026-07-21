# Ember ↔ Fitness handoff — V1 contract (frozen)

This is the frozen V1 contract for the Ember ↔ Fitness integration. Both sides implement
against this document. Changing any field name, enum value, or route requires bumping the
version (`v=2`) — do not silently change V1 behavior.

Implementation: `lib/fitnessHandoff.ts` (types + parsing/serialization helpers),
`app/from/fitness/` (inbound route).

## Product principle

- Ember remains completely useful without Fitness. Fitness supplies optional context; it
  never unlocks Ember functionality.
- No exact calorie counting anywhere in this integration.
- Fitness must not read Ember's pantry, chat history, rejected suggestions, or recipe
  database. Ember never sends recipe ingredients, pantry contents, chat text, medical
  information, or exact calories back to Fitness.
- No database migration or cross-schema access for V1. `requestId` is carried through the
  session using client-side state (`localStorage`, keyed by `cook_sessions.id`), not a DB
  column.

## Inbound: Fitness → Ember

Route: `GET /from/fitness`

Query parameters:

| param                | required | values                              |
|-----------------------|----------|--------------------------------------|
| `v`                   | yes      | `1`                                   |
| `request_id`          | yes      | UUID                                  |
| `goal`                | yes      | `gain` \| `maintain` \| `lighter`     |
| `need`                | yes      | `small` \| `moderate` \| `substantial`|
| `appetite`            | no       | `low` \| `normal` \| `high`           |
| `protein_preferred`   | no       | `1` \| `0`                            |
| `time_minutes`        | no       | positive integer, max `240`           |

Equivalent type (`NutritionIntentV1` in `lib/fitnessHandoff.ts`):

```ts
type NutritionIntentV1 = {
  version: 1;
  requestId: string;
  goal: "gain" | "maintain" | "lighter";
  need: "small" | "moderate" | "substantial";
  appetite?: "low" | "normal" | "high";
  proteinPreferred?: boolean;
  timeMinutes?: number;
};
```

Example: `/from/fitness?v=1&request_id=6f2c9b0e-6b8b-4b1a-9b0e-1e2f3a4b5c6d&goal=gain&need=substantial&protein_preferred=1&time_minutes=45`

Ember's behavior:

1. Parses and validates defensively (`parseNutritionIntent`). Unsupported `v` or malformed
   values fall back to a friendly recovery state — never a crash or a trap. The user can
   always continue into Ember's normal chat from there.
2. Translates the intent into natural language (`intentToCraving`) and feeds it as the
   existing `craving` hint into `/api/suggest`, Ember's pantry-aware suggestion flow — no
   new AI route.
3. Shows 2–3 suggestions with a subtle attribution line (`describeIntent`), e.g. "Fitness
   says today could use something substantial." No exact numbers, ever — language like
   "small," "substantial," "protein-forward."
4. The user can pick a suggestion, or ignore the Fitness context entirely and use Ember
   normally (a "Skip, just take me to Ember" escape hatch is always present).
5. On picking a dish, `requestId` is stored in `localStorage` under
   `ember-fitness-request-<cookSessionId>` right after the `cook_sessions` row is created,
   so `CookClient` can pick it up on mount.

## Outbound: Ember → Fitness

When a cook session that originated from Fitness (i.e. its `localStorage` entry is present)
reaches the finish screen, Ember shows one extra low-friction action — "I ate this" — next to
the existing completion experience. Tapping it infers the outcome from the actual recipe
cooked (`inferMealOutcome`) and navigates to Fitness.

```ts
type MealOutcomeV1 = {
  version: 1;
  requestId: string;
  eaten: boolean;
  size: "snack" | "light_meal" | "full_meal";
  proteinAnchor: boolean;
  energyBand?: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
};
```

Return URL: `${NEXT_PUBLIC_FITNESS_URL}/nutrition/ember` — `NEXT_PUBLIC_FITNESS_URL` is the
only allowlisted base; Ember never accepts or redirects to an arbitrary `return_to` from
query parameters (no open redirect).

Query parameters appended (`buildFitnessReturnUrl`):

| param             | values                              |
|--------------------|--------------------------------------|
| `v`                | `1`                                   |
| `request_id`       | original UUID                         |
| `eaten`            | `1` \| `0`                            |
| `size`             | `snack` \| `light_meal` \| `full_meal`|
| `protein_anchor`   | `1` \| `0`                            |
| `energy_band`      | `low` \| `medium` \| `high` (optional)|
| `confidence`       | `low` \| `medium` \| `high`           |

If `NEXT_PUBLIC_FITNESS_URL` is unset, `buildFitnessReturnUrl` returns `null` and Ember does
not render the "I ate this" button — no dead link, no broken flow. Ember works identically
either way.

## Out of scope for V1

- Exact calorie/macro targets or logging.
- Any Fitness read access to Ember data (pantry, chat, recipes, rejected suggestions).
- Database migrations or cross-schema access — this is pure client/session state plus query
  params.
