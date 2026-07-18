# Ember → Google Play Store: Deployment Plan

Written 2026-07-18. Target: pay the $25 Play Console fee at month end (~Jul 31) and submit
shortly after. Everything before that date is prep work that costs nothing.

## Where we are today

- Installable PWA: `app/manifest.ts` with `display: standalone`, 192/512 icons, maskable icon.
- Screen Wake Lock already implemented in the cook screen (`app/cook/[id]/CookClient.tsx`).
- **No service worker** — no offline behavior at all.
- Live at `https://ember-philipkantewa-4892s-projects.vercel.app` (no custom domain).
- Auth is silent anonymous sign-in via `proxy.ts` (no login screen).
- App collects: chat messages, pantry photos (vision route), voice audio (transcribe route),
  usage data — sent to the active AI provider (Claude via Anthropic as of 2026-07-18;
  Gemini when `BRAIN=gemini` is set) and stored in Supabase.
- No privacy policy page (required by Play).

## The route: Trusted Web Activity (TWA)

Wrap the live Vercel deployment with Bubblewrap. No app rewrite; the store app is Chrome
rendering the site fullscreen. Updates ship via normal Vercel deploys — no store re-release
except when we change the manifest/shell.

## Key timeline constraint (know this up front)

New **personal** Play Console accounts must run a **closed test with at least 12 testers
opted in continuously for 14 days** before they can apply for production access. So the
realistic production date is **mid-to-late August**, not August 1st. The plan below front-loads
everything so the 14-day clock starts as soon as possible after paying the fee.

Start recruiting the 12+ testers **now** (friends/family with Android + Gmail accounts).
This is the long pole.

---

## Phase 1 — PWA hardening (Jul 18–24, free, do first)

1. **Service worker + offline fallback.**
   - Precache the app shell and static assets; network-first for pages; a friendly offline
     fallback page ("You're offline — saved recipes still work" if feasible, else a branded
     error page).
   - Next 16 App Router: hand-rolled `public/sw.js` + registration in `app/layout.tsx`
     (check `node_modules/next/dist/docs/` for current guidance before writing it — repo rule).
   - Exclude `sw.js` from the `proxy.ts` matcher so registration isn't intercepted.
2. **Manifest polish for the store install experience:**
   - Add `id`, `orientation: "portrait"`, `screenshots` (Play and richer install UI use them),
     `categories: ["food"]`, and a real `description` check.
   - Verify the maskable icon actually looks right in a circle mask (use maskable.app).
3. **Privacy policy page** at `/privacy` — must name: anonymous accounts, chat/photo/audio
   sent to the AI provider (Anthropic currently; Google Gemini when `BRAIN=gemini`), Supabase
   storage, no ads, data deletion contact (philipkantewa@gmail.com). Play requires a public
   URL for this.
4. **Real-device pass:** run the live site in Android Chrome, install it, and test the
   whole flow — fire shader (WebGL), streaming responses, mic capture for transcribe, camera
   capture for vision, wake lock. Whatever works installed-from-Chrome works in the TWA.
5. Run Lighthouse PWA audit; fix anything flagged.

## Phase 2 — Domain decision (Jul 18–24, decide once)

The TWA is cryptographically bound to its origin via `assetlinks.json`. **If the domain ever
changes, the store app breaks** (falls back to browser UI) until re-released. Options:

- **A (recommended): buy a custom domain** (~$10–15/yr, e.g. via Vercel) and point the
  Vercel project at it before packaging. Cleaner store listing, survives Vercel project
  renames, needed anyway if Ember becomes a real product.
- **B (zero cost): ship on the `*.vercel.app` URL.** Works fine technically; just locks the
  ugly URL in and forces an app update if we later move domains.

Decision needed before Phase 3. Default to A unless budget says otherwise.

## Phase 3 — TWA packaging with Bubblewrap (Jul 25–30, free)

1. `npm i -g @bubblewrap/cli`, then `bubblewrap init --manifest=https://<domain>/manifest.webmanifest`
   (it installs its own JDK/Android SDK on first run).
2. It generates the Android project + **signing keystore**. **Back the keystore + passwords
   up immediately** (password manager + offline copy). Losing it = can never update the app.
   - Note: Play App Signing will hold the *app* signing key, but our upload key still
     matters; enroll in Play App Signing at first upload.
3. Serve `/.well-known/assetlinks.json` (Bubblewrap prints the SHA-256 fingerprint):
   - Put it in `public/.well-known/assetlinks.json`.
   - **Must-do:** extend the `proxy.ts` matcher to exclude `.well-known` — today the proxy
     would intercept it and run Supabase auth on it.
   - Because Play App Signing re-signs the production app, after first upload add **Play's**
     signing-key fingerprint (from Play Console → App integrity) to assetlinks too — with
     only the local fingerprint, the store-installed app shows Chrome's URL bar.
4. `bubblewrap build` → `app-release-bundle.aab`.
5. Sideload the APK build on a real phone and verify: no URL bar, splash screen, icon,
   deep links open in-app.

## Phase 4 — Play Console setup (~Jul 31, the $25 step)

1. Create the developer account (personal, one-time $25) with the Google account you want
   to own this long-term. Identity verification can take a couple of days — do it same day.
2. Create the app, then complete every dashboard task:
   - **Store listing:** name "Ember", short + full description, 512×512 icon,
     **1024×500 feature graphic** (needs to be made — Phase 5), ≥2 phone screenshots.
   - **Privacy policy URL** → the `/privacy` page from Phase 1.
   - **Data safety form.** Declare honestly: collects photos, voice/audio, in-app messages,
     app activity; shared with AI provider for app functionality; data encrypted in transit;
     deletion on request. Getting this wrong is the #1 rejection cause.
   - **Content rating questionnaire** (should land at Everyone/PEGI 3).
   - Ads declaration: none. Target audience: 18+ (simplest; avoids child-safety obligations).
3. Upload the `.aab` to **Internal testing** first (instant, up to 100 testers) — sanity
   check the store-delivered build, and grab the Play App Signing fingerprint for
   assetlinks (Phase 3.3).

## Phase 5 — Store assets (parallel with Phase 3–4)

- Feature graphic 1024×500 (dark ember/fire aesthetic to match the app).
- 4–8 phone screenshots (1080×2400): suggest screen, cook screen with fire timer, pantry,
  explore. Take on a real device or emulator; consider light framing/captions.
- Tighten the store description copy (first 80 chars of short description matter most).

## Phase 6 — Closed testing, the 14-day clock (early–mid Aug)

1. Promote the internal build to **Closed testing**, create an email-list track, add the
   12+ testers, send them the opt-in link.
2. Testers must **stay opted in for 14 consecutive days** and ideally actually open the app.
   Chase them; a dropout below 12 pauses the clock.
3. Use the window to fix whatever they hit; pushing web fixes needs no new build.
4. After 14 days, fill in Play's **production access application** (they ask what you tested,
   what feedback you got — answer substantively, one-word answers get rejected).

## Phase 7 — Production (mid–late Aug)

1. Once production access is granted, promote the tested `.aab` to Production.
2. First production review typically takes up to ~7 days for a new account.
3. Post-launch checklist: verify assetlinks/no-URL-bar on a store install, check
   Play Console vitals (crashes = usually Chrome/WebGL issues), log the release in
   `UPDATES.md`.

---

## Cost summary

| Item | Cost |
|---|---|
| Play Console account | $25 one-time (month end) |
| Custom domain (optional, recommended) | ~$10–15/yr |
| Everything else | $0 |

## Risks / open items

- **12-tester requirement** is the schedule risk — recruit now.
- `BRAIN=gemini` vs Anthropic doesn't block the store, but the privacy policy should be
  worded to cover "AI providers" generically so switching back needs no policy change.
- Anonymous auth means uninstall/reinstall loses user data (new anonymous user). Acceptable
  for v1; a real login can come later without a store re-release.
- Background cook timers: web timers can die when Android kills the tab. Watch for tester
  complaints; the fix (server-side push notification at timer expiry) is web-only, no
  native code needed.
