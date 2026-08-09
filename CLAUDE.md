@AGENTS.md

# Ember — AI / developer guide

AI cooking-copilot PWA.

## Stack

- **Next.js 16** (`--webpack`, not the default Turbopack — see `AGENTS.md`), React 19,
  Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/react`), **Supabase**.
- Live on **Vercel**.

## Commands

```bash
npm install
npm run dev      # next dev --webpack
npm run build    # next build --webpack
npm run lint
```

## Conventions / gotchas

- **AI provider (checked 2026-08-09): OpenAI, and there is no `BRAIN` switch any more.**
  `lib/ai.ts` creates one `createOpenAI` client and exports `brain` = `eyes` =
  `gpt-5.6-luna`. There is no `spareBrain` and no provider fallback. Earlier notes here
  claimed Gemini, then Claude — both are wrong; read `lib/ai.ts` rather than this line.
- **Prompt caching is automatic, not explicit.** OpenAI caches on exact prefix match, so the
  only thing that buys anything is keeping the front of the request byte-identical between
  turns: static rules in `instructions`, volatile state (pantry, current step) appended
  *after* the history. `anthropic.cacheControl` breakpoints do nothing here — the provider
  drops them. Both chat routes were rewritten this way on 2026-08-09.
- `reasoningEffort` is a real cost dial (reasoning tokens bill as output), which is why
  `lib/ai.ts` pins "medium" rather than leaving it high — see the note there.
- **Fitness integration:** `/api/nutrition/suggest` is a machine-to-machine route used by the
  Guided Training nudge scheduler. It is gated by `FITNESS_INTEGRATION_SECRET` and reads the
  pantry through the `public.ember_pantry_for_integration` RPC — that RPC is Ember's alone to
  call, which is what keeps pantry contents on this side of the boundary. See
  `docs/integrations/fitness-v2.md`.
- **Fitness standing link (V3):** cooks that *didn't* start from a Fitness nudge can now log too,
  via a Settings toggle (`ember.profiles.fitness_auto_log`) and `/api/nutrition/log`. Requires a
  new `EMBER_FITNESS_LOG_SECRET` on both Ember and Fitness, and a matching endpoint Fitness has
  to implement — see `docs/integrations/fitness-v3.md` for the exact contract. Until Fitness ships
  that endpoint, the toggle is safe to ship but inert (calls fail soft).
- **Fitness reserve-a-recipe (V4):** `/api/nutrition/reserve` lets Fitness lock in a dish at
  planning time and get the real recipe back immediately (persisted in
  `ember.fitness_reserved_recipes`), so `/from/fitness?recipe_id=...` opens it later instead of
  generating fresh. Same secret as V2/`/suggest`, no new env vars. See
  `docs/integrations/fitness-v4.md`.
- Supabase: dedicated `ember` schema (shared Supabase project — see other projects' CLAUDE.md
  for which project/schemas are neighbors before touching cross-cutting config).

## Conventions

- Log every meaningful change to `UPDATES.md` — newest entry at top.
