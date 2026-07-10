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

- **`BRAIN=gemini`** env override is currently in effect — Anthropic credits are empty, so the
  app is routed to `@ai-sdk/google` instead of `@ai-sdk/anthropic`. Don't assume Claude is the
  active model without checking this env var; switch back once Anthropic credits are restored.
- Supabase: dedicated `ember` schema (shared Supabase project — see other projects' CLAUDE.md
  for which project/schemas are neighbors before touching cross-cutting config).

## Conventions

- Log every meaningful change to `UPDATES.md` — newest entry at top.
