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

- **AI provider (checked 2026-07-30): this flipped.** Gemini prepayment credits are now
  *depleted* and Anthropic works, so `BRAIN` is **unset in production** and Claude is the brain.
  The older "BRAIN=gemini because Anthropic is empty" note no longer holds — check which
  provider actually has credit before assuming. `lib/ai.ts` exports `spareBrain` (the other
  provider) for unattended jobs; `/api/nutrition/suggest` tries both before failing.
- **Fitness integration:** `/api/nutrition/suggest` is a machine-to-machine route used by the
  Guided Training nudge scheduler. It is gated by `FITNESS_INTEGRATION_SECRET` and reads the
  pantry through the `public.ember_pantry_for_integration` RPC — that RPC is Ember's alone to
  call, which is what keeps pantry contents on this side of the boundary. See
  `docs/integrations/fitness-v2.md`.
- Supabase: dedicated `ember` schema (shared Supabase project — see other projects' CLAUDE.md
  for which project/schemas are neighbors before touching cross-cutting config).

## Conventions

- Log every meaningful change to `UPDATES.md` — newest entry at top.
