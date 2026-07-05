# Ember — update log

## 2026-07-05

### Brain model bump on Gemini stopgap
- Upgraded `brain` (suggestions/recipes/cook coaching) from `gemini-2.5-flash` to
  `gemini-2.5-pro` when `BRAIN=gemini`, to try better reasoning/instruction-following on
  structured recipe gen + `amend_recipe` tool calls while Anthropic credits are still empty.
  `eyes` (pantry vision) left on `gemini-2.5-flash`. Redeployed to Vercel production.

## 2026-07-04

### Verified end-to-end + deployed
- Full browser verification with a test user (ember-test@ember.local.test): onboarding →
  pantry CRUD → suggestions → recipe generation → cook session with a mid-cook pivot that
  triggered `amend_recipe` (steps rewritten in UI **and** DB) → finish flow → explore
  generation (8 dishes incl. kapana) → vision endpoint (real food photo → 11+ ingredients).
- **Anthropic key has NO credit balance** — brain temporarily switched to Gemini via
  `BRAIN=gemini` env override (`lib/ai.ts`); remove the env var after topping up credits
  to run on Claude Sonnet 5. Array min/max removed from zod schemas (Gemini structured
  outputs reject them; counts moved into prompts).
- Deployed to Vercel: https://ember-philipkantewa-4892s-projects.vercel.app (project
  `ember`); env vars pushed; Vercel Authentication (deployment protection) disabled so the
  app is public. GROQ_API_KEY still missing — voice returns 503 until added.

## 2026-07-03

### Full v1 feature build
- `ember` schema live on shared Supabase (5 tables, RLS, private storage bucket) + `ember`
  added to PostgREST exposed schemas; advisor warning on trigger search_path fixed.
- Pantry: equipment/skill onboarding, manual CRUD, camera photo → Gemini vision → confirm sheet.
- Suggestions (`/api/suggest`) + full structured recipe generation (`/api/recipe`) via
  Claude Sonnet 5 `generateObject`; suggestion cards with match/substitution badges.
- Cook mode: one-step-per-screen UI, heat badges, watch-for cues, per-step timers, wake lock,
  session persistence/resume, streaming chat (`/api/cook`) with `amend_recipe` tool that
  rewrites remaining steps live.
- Voice: push-to-talk (MediaRecorder → Groq Whisper `/api/transcribe`) + spoken replies via
  speechSynthesis with mute toggle. NOTE: GROQ_API_KEY not found locally — endpoint returns 503
  until the key is added to `.env.local`.
- Explore: cached Claude-generated dish grid with per-user pantry diff → same recipe/cook flow;
  added insert policy for authenticated on `ember.explore_dishes`.
- Switched dev/build to webpack (`--webpack`): Windows Application Control blocks the native
  Turbopack binary on this machine.

### Scaffold (session start)
- Created project: Next.js 16 (App Router, TS) PWA + Supabase (`ember` schema in shared
  project) + Vercel AI SDK (Claude brain, Gemini vision, Groq Whisper voice).
- Brand system in `globals.css` (charcoal/ember/cream, Fraunces + Outfit), PWA manifest,
  tab-bar shell, email-OTP login, `proxy.ts` auth gate (Next 16 middleware replacement).
