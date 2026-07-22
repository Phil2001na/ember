# Ember — update log

## 2026-07-22

### Light mode + Settings page
- Added a cream-and-charcoal light theme alongside the existing dark default —
  same brand system, only color tokens flip. All backgrounds, borders, and
  text now resolve through CSS variables (`--bg`, `--text`, `--border`,
  `--surface-3`, the frosted-glass bar/sheet/input fills, skeleton shimmer),
  toggled by a `data-theme` attribute on `<html>`.
- Split the icon/label accent color from the raw palette into
  `--accent-icon` / `--accent-icon-soft` / `--accent-amber` so decorative
  orange/amber text stays legible on a light background instead of washing
  out, while button gradients keep their original bright tones in both themes.
- New `ThemeProvider`/`useTheme` (localStorage-backed, `ember-theme` key) plus
  a `beforeInteractive` script in the root layout so the stored theme applies
  before first paint — no flash of the wrong theme on load or reload.
- New `/settings` page (linked from Profile) with an "Appearance" section
  housing the Dark/Light `ThemeToggle` segmented control. Dark stays the
  default for new sessions.

## 2026-07-21

### 21:21 — Home nudge copy: drop the "tell me who" ask
- The evening "cooking to impress" home-screen nudge asked "Tell me who"
  without ever using an answer (tapping it just sends a fixed prompt to
  chat) — read as an intrusive, unpaid-off personal question. Reworded
  to "Cooking to impress tonight?" so the copy doesn't ask for something
  the app was never going to collect.

### 18:56 — Fitness handoff integration
- Added a versioned, privacy-preserving Fitness → Ember route that validates nutrition intent,
  reuses pantry-aware suggestions, and always offers a normal Ember escape hatch.
- Added the cook-completion return handoff behind `NEXT_PUBLIC_FITNESS_URL`, carrying only a
  request ID and coarse meal outcome through local session state; documented the frozen V1 contract.

### 18:39 — Onboarding polish, tap-to-talk mic, multi-user DB verified
- Onboarding is now a 3-step flow with progress dots: a warm welcome step
  (what Ember is + name), then kitchen (equipment + skill), then the pantry
  ramble — with back navigation, benefit-oriented copy, and a "takes about
  a minute" promise. Grounded in onboarding research: fast time-to-value,
  endowed progress, personalization before commitment.
- Ramble/mic button (`PushToTalk`) changed from press-and-hold to
  tap-to-start / tap-to-stop (hold was unreliable on web). Recording state
  shows a stop square + pulsing red ring; 60s auto-stop safety net. Applies
  everywhere: onboarding, home chat, mid-cook chat.
- Applied the two missing migrations to the live Supabase project
  (`ember.planned_meals`, `ember.recipe_shares` — planned meals and recipe
  share links were broken in prod without them). Verified every `ember`
  table has owner-only RLS, so each user (anonymous or email-linked) has
  their own pantry, recipes, shopping list and sessions.

### 14:19 — Identify a dish from a photo (e.g. a TikTok screenshot)
- "Planning to cook something?" gets a camera button next to the text
  input: upload a photo of a dish (a screenshot from a video, a plated
  photo) and new `/api/dish-recognize` (Gemini vision) guesses the dish
  name and drops it into the input for you to confirm or edit before
  running the existing `/api/dish-check` flow — nothing is added to the
  list until the user reviews the guessed name and taps "Check it".
- Low-confidence guesses are flagged inline rather than presented as fact.

## 2026-07-20

### 23:21 — "Buy again" moves a finished pantry item to the shopping list
- Pantry item rows get a "buy again" button alongside the X: instead of
  just deleting something you've run out of, it removes it from the
  pantry and upserts it straight onto the shopping list (same quantity
  text carried over). Plain X still just deletes, for corrections.

### Planned meals — "I want to make X" drafts the shopping list
- Shopping page gets a "Planning to cook something?" card above the AI-draft
  button: type a dish name, Ember (`/api/dish-check`) works out the real
  ingredient list and checks it against the pantry, then one tap adds what's
  missing to the shopping list (tagged `for <dish>`) and remembers the dish.
- New `ember.planned_meals` table (migration `004_planned_meals.sql`) holds
  those remembered dishes so they survive past the session — each shows as a
  small row with a to-buy count, a "cook it" button that writes the full
  recipe (`/api/recipe`) and starts a cook session, and a remove button.
  Reuses the existing `/api/dish-check` + `/api/recipe` + `cook_sessions`
  plumbing rather than adding new AI routes.
- Replaces the old "random" pantry-only shopping suggestions as the primary
  way to build a list around a specific future meal; the pantry-restock
  draft button stays for general restocking.

### 00:25 — Meal unlocks, recipe sharing, and mobile timers
- Shopping suggestions now identify one-item meal unlocks and show the specific dishes each small purchase makes possible.
- Added privacy-safe recipe sharing through immutable UUID snapshots and public links that open directly into Ember’s guided cook. The isolated `ember.recipe_shares` migration is prepared but not applied to the shared Supabase project.
- Timer completion now uses Android-compatible service worker notifications and reopens the exact cook when tapped; killed-app delivery still requires scheduled web push or a native bridge.

### 00:07 — Frictionless pantry onboarding
- Added a voice-or-text kitchen “rant” step to onboarding; Ember extracts a lightweight ingredient list for confirmation instead of requiring manual cataloguing.
- Added the authenticated pantry-import AI route and quantity-aware pantry upsert flow.
- Added rotating, pantry-aware home nudges for intents such as “choose for me,” low-effort cooking, using up ingredients, and cooking to impress.
- Added push-to-talk to the main kitchen composer so spoken intents go straight to Ember.

## 2026-07-19

### 21:32 — Baking side
- `RecipeStepSchema` gained `oven_temp_c` (°C, nullable); `heat` is now
  stovetop-only. Cook mode shows an oven dial (thermometer, scaled to 250°C)
  when a step has an oven temp, falling back to the heat dial otherwise.
- Recipe prompt: oven temps required on oven steps (incl. preheat); baking
  amounts are precise — grams if a kitchen scale is in equipment, level
  cups/spoons otherwise (the old blanket "assume no scale" rule fought baking).
- Long passive waits (proofing, cooling) get their own step + timer, and cook
  timers now persist to localStorage per session so an hour-long proof
  survives a tab reload; cleared on finish.
- Equipment options: added "kitchen scale" and "baking tins & trays".
  Suggestions may include a pantry-supported bake; Explore batches now always
  include at least one baked good.

### 14:40 — Email accounts (anonymous-first, link to keep data)
- New `AccountCard` on the profile page: anonymous users can "Save your
  kitchen" (attach email+password to the same user via
  `auth.updateUser` — all data keeps its user_id) or sign in to an
  existing account on a new device.
- `/auth/confirmed` landing page for the email-confirmation link.
- Privacy policy updated: email is optional, sign-in only, never marketing.
- Decision: stay in the shared Supabase project (`ember` schema) — free
  per-user limit is 2 active projects; split out via schema dump when the
  app justifies Pro.
- MANUAL STEP (Supabase dashboard, shared project): add
  `https://<ember-domain>/auth/confirmed` to Auth → URL Configuration →
  Redirect URLs, or the confirmation email will bounce users to the
  project-level Site URL (another app's domain).

### 14:05 — Play Store Phase 1: PWA hardening
- Service worker (`public/sw.js`): network-first pages with offline fallback,
  cache-first for hashed build assets; `/api/*` never cached. Registered via
  new `app/sw-register.tsx` in the root layout.
- New branded `/offline` fallback page and `/privacy` policy page (Play
  Console requires a public privacy-policy URL).
- Manifest: added `id`, `scope`, `orientation: portrait`, `categories: [food]`.
- `proxy.ts` matcher now excludes `sw.js` and `.well-known` (for the
  upcoming TWA `assetlinks.json`).

### 00:23 — Gauge surface smolders
- Track shader: the bar's top edge is now perturbed by the flame noise
  (subtle wobble) so the molten surface reads ragged/smoldering instead of
  ruler-straight.

## 2026-07-18

### 23:57 — Flame turns gas-stove blue as timers finish
- `FireCanvas` shader: added a blue color ramp mirroring the fire palette;
  the flame blends from orange to gas-stove blue gradually from ~80% progress,
  fully blue at done (both chip and track variants).
- Finished timers now keep their flame (blue, still animated) instead of
  hiding it — timer chips and the step-card track.
- Done-state accents (chip tint/pulse, step-card border, "Done!" text) moved
  from green to a matching `--blue-flame`.

### Gauge heats up with progress
- `FireCanvas` track shader: heat now scales with `u_progress` — the bar
  smolders a deep ember orange early and ramps to the full white-hot molten
  look toward the finish. Flame fringe and the leading-edge ember pulse grow
  with it.

### Mid-cook chat can now set real timers
- Added a `start_timer` tool to `/api/cook` with a prompt rule: whenever Ember
  tells the user to do something for a specific duration, it starts a countdown
  instead of just saying "(for 4 minutes)".
- `CookClient` applies the tool client-side (same pattern as `amend_recipe`),
  starting the timer on the current step via `useCookTimers` — it shows in the
  TimerBar, vibrates/notifies on finish, and replaces any timer already on
  that step (right for "give it 2 more minutes").
- KNOWN LIMITATION (watch for wonkiness): timers are keyed by step index, so a
  chat timer replaces the current step's own running timer. Concurrent timers
  across different steps are fine; the bad case is asking Ember to time
  something unrelated while standing on a step whose timer is running — it
  clobbers it. If this bites in real cooking, the fix is giving chat timers
  their own key + jump-target step in `useCookTimers`/`TimerBar`.

### Play Store deployment plan
- Wrote `PLAY_STORE_PLAN.md`: TWA/Bubblewrap route from current PWA state to
  Google Play production, phased around paying the $25 Console fee at month
  end and the 14-day/12-tester closed-testing requirement for new personal
  accounts (realistic production: mid–late August).

### Switched brain back to Claude + Anthropic prompt caching
- Removed the `BRAIN=gemini` stopgap from `.env.local` (Anthropic credits
  topped up) — `brain` is `claude-sonnet-5` again. The same env var still
  needs removing in Vercel for prod.
- Added Anthropic prompt caching to `/api/cook` and `/api/kitchen-chat`:
  system prompt moved to the AI SDK v7 `instructions` array with a
  `cacheControl` breakpoint on the stable block, plus a breakpoint on the
  last history message so each turn reads prior turns from cache. The
  volatile "currently on step N" line sits in its own uncached system
  message. Verified live: 2nd call read 6,642 tokens from cache (2 uncached).

### Cook-step card feedback pass
- Swapped "Step details" and "Watch for": the step's explanation now sits
  inside the active-step card (next to the timer controls) and the watch-for
  cue moved to its own section below the card.
- Removed the 0/50/100% scale under the fire progress bar.
- Tamed the track fire into a gauge: solid molten bar with a short flame
  fringe and a tighter leading edge (was tall wildfire tongues + drifting
  sparks); track height 58px → 34px. Timer chip fire unchanged.

### Redesigned the cook-step screen around a single "active step" card
- Merged the instruction heading, heat level, countdown, fire progress bar,
  "watch for" cue, and Pause/Reset controls into one `StepCard` component
  (replaces `StepTimer`) — matches the concept art and makes better use of
  screen space instead of stacking separate cards/badges down the page.
- New `HeatDial`: a circular SVG gauge (replaces the small heat pill) with a
  glowing arc that pulses gently while a timer is running.
- The step's longer explanation now lives in its own "Step details" section
  below the card, with a CSS `::first-line` treatment (serif, larger) so the
  opening reads like a mini heading without adding new schema fields.
- Fixed stale fire canvas on backgrounded tabs: the shared rAF ticker fully
  suspends while a tab is hidden, but `FireCanvas` was only repainting when
  first subscribing — a timer's progress could advance for minutes with the
  canvas frozen on its mount-time frame. Now redraws immediately whenever the
  tab is hidden. Also softened/brightened the fire shader (wider glow halo,
  brighter color ramp, taller track) to better match the intended warm,
  glowing look instead of the harsher jagged edge from the first pass.

## 2026-07-17 19:50

### Procedural WebGL fire for timers + horizontal chip fill + UX polish
- Replaced the CSS/SVG flame strip with a real procedural fire: new
  `FireCanvas` renders fbm-noise flames in a transparent WebGL canvas —
  morphing tongues, flame-licked leading edge drawn by the shader at the
  progress line, ember-palette color ramp. Chip + track variants (track adds
  a pulsing leading-edge hotspot and drifting sparks).
- Timer chips now fill **left→right** (was bottom-up) — consistent with the
  step-card track and reading direction; fill advances continuously via
  per-frame lerp instead of 1 Hz steps.
- One shared rAF ticker (`lib/fireTicker.ts`) for all canvases; suspends on
  hidden tab and when paused timers settle. Reduced-motion → single static
  frame. WebGL context loss handled; no-WebGL fallback keeps the old CSS
  flames. DPR capped, `low-power` context, no new dependencies.
- UX polish: chip icon buttons get a ~42px hit area (Fitts's law) and wider
  gap; `aria-live` announcement when a timer finishes; `.sr-only` utility.

## 2026-07-15 22:40

### Timer chips: activity labels + fire fill animation
- Floating timer chips now show the step's activity ("Simmer the bolognese…")
  instead of "Step 5", truncated with the full text on long-press/hover — no
  more guessing which timer is which.
- New fire fill animation: a flame bed rises inside each chip as the timer
  gets closer to done, with animated flickering flame licks along the fire
  line (blurred red-orange glow layer + bright amber licks, CSS-only,
  tiled SVG so tongues keep their shape at any width). Pausing dims and
  freezes the flames.
- Step timer card gets a matching fire progress track: gradient bar that
  fills left→right with flames riding the filled length and a pulsing
  ember dot at the leading edge (per the concept image).
- Shared `FlameStrip` component + `.flame-strip`/`.fire-track-*` CSS;
  respects `prefers-reduced-motion`.

## 2026-07-15 16:30

### UI upgrade: on-brand outline icons + mockup-driven polish
- Added `lucide-react`; every emoji glyph in the UI (🔥💬🧺🛒📖✨🎤✓✕ arrows,
  play/pause, etc.) replaced with stroke-style icons tinted to the ember
  palette — consistent across tab bar, cook flow, chat, pantry, shopping,
  explore, saved, and profile. The big flame on the finish screen stays.
- Tab bar: floating pill → wide labeled glass bar (icon + label per tab,
  active tab glows ember), per the generated design mockup.
- Recipe preview rebuilt to the mockup: "Let's get cooking." serif heading,
  Ingredients card with divided bullet rows + "View all ingredients"
  expander, "You'll use" equipment tiles with keyword-matched icons,
  pill-shaped Start cooking button.
- Cook step screen: icon back button + centered title + outlined "n / N"
  step pill, bigger serif step heading, roomier body text, "Watch for" card
  with lightbulb icon, Back/Next pill buttons with arrows, "Ask Ember
  anything" button with speech-bubble icon.
- Finish screen: "You *made it*." italic gradient accent, new "Great work!"
  card, save action restyled as an icon row card, Back home pill with home
  icon.
- Buttons are now pill-shaped app-wide; new shared CSS primitives
  (`.section-head`, `.list-card`/`.list-row`, `.equip-tile`, `.icon-btn`,
  `.row-card`, `.badge-outline`, `.accent-serif`).

## 2026-07-15 00:00

### Cook session: shared, concurrent step timers
- Timer state lifted out of `StepTimer` into a new `useCookTimers` hook owned
  by `CookClient`, keyed by step index — timers now survive step navigation
  and unmounts instead of resetting when you leave a step.
- Multiple timers can run concurrently (e.g. start step 5's simmer timer,
  move on to prep step 6, step 5 keeps counting in the background).
- New floating `TimerBar`: a pinned pill at the top of the cook screen
  listing every active timer with its step and remaining time; tap a chip to
  jump back to that step, or pause/dismiss it in place.
- Timers keep ticking against a wall-clock end time (not a naive interval
  countdown), so they stay accurate even if the tab is backgrounded. On
  hitting zero: haptic buzz (existing) plus a browser/PWA `Notification` when
  permission has been granted (requested on first timer start) — the finished
  chip also pulses green in the floating bar as an in-app alert.
- Existing per-step Pause/Reset controls preserved, now operating on the
  shared timer instance for that step instead of local component state.

## 2026-07-10 16:47

### AI-drafted shopping list
- New `/api/shopping-suggest` route: the brain drafts 5-10 items from the
  kitchen context — restocks things marked running low, items that unlock real
  meals with the current pantry (dish named in the reason), and genuinely
  missing staples; respects dietary notes and dedupes against the current list.
- List tab: "✨ Let Ember draft my list" button (primary when the list is
  empty), skeleton rows while thinking, suggestion card with per-item +add /
  dismiss and "Add all". Accepted suggestions keep their quantity + reason and
  go through the existing offline-safe mutate queue. Disabled while offline.

## 2026-07-10 16:05

### Shopping list — pantry-aware, offline-safe
- New `ember.shopping_items` table (migration `003_shopping_list.sql`, applied to
  Supabase): name unique per user, optional quantity/reason, `checked` flag, RLS.
- New **List** tab (`/shopping`): add items (warns if it's already in your pantry,
  with "buy more anyway"), tick items off while shopping, "🧺 have it" moves an
  item straight to the pantry, and "Done shopping" puts everything ticked away in
  the pantry in one tap.
- Offline-first: every change is saved to localStorage immediately and queued as
  a name-keyed op; the queue flushes to Supabase on load/`online` events, so
  ticking off with no data in the store syncs when back home. A banner shows
  pending-sync count while offline.
- Cook chat integration: new `update_shopping_list` tool — "I need to buy
  parmesan" adds to the list (never items already in the pantry), "I bought X"
  moves it pantry-ward; 🛒 badges show list changes in chat. Dish suggestion
  cards with missing ingredients grew an "Add missing to shopping list" chip.
- `loadKitchen`/`kitchenPrompt` now include the shopping list, so all AI routes
  know what's already planned to be bought.

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
