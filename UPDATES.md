# Ember — update log

## 2026-07-08 03:20

### UI glow-up — glass, gloss, gradients, grain
- Rebuilt the brand system in `globals.css` (same class/token names, whole new look):
  - Ambient ember atmosphere: fixed radial glows (ember from the top, amber from a
    corner) bleeding through a near-black base, plus an SVG film-grain overlay
    (`fractalNoise`, blend-mode overlay) over the whole app — the texture layer.
  - Glass surfaces everywhere: translucent warm-white surfaces with specular
    top-light (`inset 0 1px 0` highlights), gradient cards, glossy 3-stop ember
    gradient on primary buttons with inner sheen + outer glow.
  - Tab bar is now a floating glass pill (backdrop blur + saturate) with a lit
    ember pill on the active tab, instead of a full-width bottom bar.
  - New primitives: `.sheet`/`.sheet-backdrop` (glass bottom sheets with grab
    handle + slide-up spring), `.composer`/`.composer-btn` (pill chat bar),
    `.bubble-user`/`.bubble-ai` (gradient chat bubbles), `.title-glow`
    (cream→amber→ember gradient text for hero headings).
- Components moved onto the new primitives: KitchenChat (glass composer, gradient
  bubbles, glowing greeting), PantrySheet + ChatDrawer (glass sheets), PushToTalk +
  mute (round composer buttons, recording = red glow), cook progress bar glow,
  "You made it." gradient title. Theme color → `#0e0c0a` (layout + manifest).
- Fixes found while verifying in-browser: pantry sheet rendered *under* the
  floating tab bar (KitchenChat's fixed container needed `zIndex: 60`), and the
  suggestion carousel leaked a horizontal scrollbar into the chat scroll area
  (`minWidth: 0` on message rows + `overflowX: hidden`).
- Verified every key screen in Playwright: home/chat (bubbles + carousel), pantry
  sheet, pantry page, explore, cook step, Ask Ember drawer, finish screen,
  onboarding. Typechecks clean.

## 2026-07-07 (4) 22:30

### Self-maintaining pantry (conversational)
- The pantry now keeps itself through the chat instead of manual bookkeeping:
  - New `update_pantry` tool in `/api/kitchen-chat` — "I bought eggs, mince and
    peppers" or "used the last of my eggs" upserts/deletes `ember.pantry_items`
    mid-conversation; a small `🧺 + egg, beef mince · − cream` badge renders in
    the chat where it happened.
  - Chat prompt now defaults to EXACTLY 2 dish suggestions: the best fit plus a
    noticeably quicker fallback ("one if that'll take too long"); 1 if an exact
    dish was named.
  - New `components/PantrySheet.tsx`: attachment-style 🧺 button beside the chat
    input (like ChatGPT's paperclip) opens a bottom sheet of the live pantry —
    tap a chip to remove what you don't actually have, quick-add input, link to
    the full /pantry page for camera scan.
  - Post-cook pantry check: new `/api/used-up` route — on "Done — I cooked it",
    the brain reads the recipe + the cook-chat (substitutions count) + pantry
    quantities and proposes which items got finished off; the finish screen
    shows them as pre-selected chips → tap any you still have → one-tap
    "Update pantry" (or Skip). Staples (salt/oil/rice) never get proposed.
- Verified end-to-end in-browser with a fresh anon user: chat add ("bought eggs,
  beef mince, peppers, onion, cream" → 🧺 badge + exactly 2 suggestions, one
  quick with everything on hand) → 🧺 sheet (tap-removed pepper, quick-added
  rice; recipe gen picked both changes up) → cooked the frittata through all 8
  steps, told the cook chat "cream had gone off, binned it, used milk" →
  finish screen proposed beef mince, onion, cream (cream from the chat, not the
  recipe!) → deselected onion → Update pantry → /pantry correctly shows only
  rice, egg, onion → chat "used the last of my eggs" → 🧺 − egg removal.

## 2026-07-07 (3)

### Saved recipes
- New `ember.saved_recipes` table (migration `002_saved_recipes.sql`, applied to the
  live shared Supabase project): `user_id`, `recipe` jsonb, `saved_at`, RLS scoped
  to the owning user like every other Ember table.
- The cook-session "You made it" finish screen (`CookClient.tsx`) now has a
  "📖 Save this recipe" button next to "Back home" — inserts the finished recipe,
  then flips to a disabled "✓ Saved to your recipes" state.
- New `/saved` page + `SavedClient.tsx`: lists saved recipes (title, description,
  time/servings/steps), tap one to open the existing `RecipePreview` — "Start
  cooking" creates a fresh `cook_sessions` row and jumps into `/cook/[id]`, same
  flow as Explore/Suggest/the chat. Each row has a ✕ to remove it.
- Linked from Profile ("You" tab): a "📖 Saved recipes" card showing the count,
  linking to `/saved`. Not added as a 5th bottom tab to avoid crowding the nav.
- Verified end-to-end in-browser: typechecks clean; chatted "I want to cook a
  simple tomato pasta" → carousel appeared (confirms the chat's suggest_dishes
  round-trip, unverified last session, does work) → picked a dish → cooked
  through all 8 steps → "Done — I cooked it" → saved → confirmed it shows on
  `/saved`, opens via `RecipePreview`, and the ✕ delete removes it → confirmed
  the Profile card's count updates and links correctly.

## 2026-07-07 (2)

### "Cook" tab is now a chat
- Home page (`/`, the "Cook" tab) is replaced with a ChatGPT-style conversation
  (`components/KitchenChat.tsx`) instead of the old greeting + two buttons. Type
  what you want to cook, or what you've got lying around, in plain language.
- New `/api/kitchen-chat` route: `streamText` + a `suggest_dishes` tool (reuses
  the existing `SuggestionsSchema`) that the model calls whenever it has enough
  to propose 1-5 concrete dishes, checked against the pantry.
- New `components/SuggestionCarousel.tsx`: renders those dishes as a horizontally
  swipeable row of cards (scroll-snap) inside the chat, instead of a vertical
  list — new `.hscroll`/`.hscroll-item` CSS in `globals.css`.
- Picking a card reuses the exact existing flow: `/api/recipe` → `RecipePreview`
  → `cook_sessions` insert → `/cook/[id]`, same as `/suggest` and Explore already
  did (copy-pasted that logic into `KitchenChat`, not shared yet).
- Chat is ephemeral (no persistence) — refreshing the home page clears it. The
  active-cook-session banner and the empty-pantry nudge (linking to `/pantry`)
  moved into the chat header. `/suggest` page/API left untouched and still
  reachable directly, just no longer linked from home.
- Verified: typechecks clean; browser-tested chat rendering (greeting, empty
  state, input) and the `/api/dish-check` + suggestion-carousel plumbing that
  this reuses, but didn't get to fully click through a live suggest_dishes
  round-trip before this session ended — worth a quick end-to-end check next
  time before relying on it.

## 2026-07-07

### "I want to cook X" flow
- New `/api/dish-check` route: given a free-typed dish name, Gemini works out the
  real ingredient list and checks each item against the pantry (`have` true/false
  + an optional pantry substitution), and decides `can_improvise` (false if a
  defining ingredient has no workable substitute).
- `/suggest` page now has an input above the pantry-based suggestions: "Know
  exactly what you want?" → shows the ingredient checklist (✓ have it / need it)
  → "Let me get the rest" (writes the authentic recipe, real ingredients, no
  forced substitutions) or "Improvise with what I have" (pantry-only, disabled
  with an explanation when `can_improvise` is false).
- `/api/recipe` gained a `mode` param: `"authentic"` uses real ingredients
  (default `improvise` behavior unchanged, so the existing pantry-suggestion flow
  isn't affected).
- Verified end-to-end in-browser: typed "chicken curry" with a rice/onion/garlic/
  olive oil/salt pantry → correctly flagged chicken, ginger, curry powder, coconut
  milk as missing with no substitutes, disabled improvise with a clear reason, and
  "Let me get the rest" produced a proper chicken curry recipe.

## 2026-07-06 11:57

### Removed email login, auto sign-in anonymously
- Ripped out the OTP email/code login screen (`app/login`) and the sign-out button — for now
  it's just Philip using the app, so no login step should be needed at all.
- `proxy.ts` now silently calls `supabase.auth.signInAnonymously()` when there's no session,
  instead of redirecting to `/login`. Enabled "Allow anonymous sign-ins" in the shared Supabase
  project's Auth settings (was disabled by default) to make this work.
- Anonymous users get the `authenticated` role and a real `user_id`, so existing RLS/onboarding
  flow works unchanged — a fresh anon session just lands on `/onboarding` like any new user.
- Note: session lives in a cookie, so clearing cookies/switching browsers starts a new identity
  (no data recovery). Fine for personal use now; revisit if this needs to be multi-device or
  multi-user later. Also worth adding captcha on anonymous sign-in eventually since the app is
  publicly live with no deployment protection (Supabase's own recommendation).

## 2026-07-05

### Pushed to GitHub + connected Vercel
- Created private GitHub repo `Phil2001na/ember` from the existing local git history and
  pushed master; connected the existing Vercel project (`ember`) to it via `vercel git connect`
  so future pushes to master auto-deploy.

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
