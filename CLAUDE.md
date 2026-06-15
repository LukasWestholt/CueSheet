# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server on http://127.0.0.1:5173 (host is 127.0.0.1, not localhost — Spotify only accepts loopback-IP redirect URIs)
npm run build      # tsc -b && vite build  → dist/ (also generates the PWA service worker)
npm run preview    # serve the production build
npm run typecheck  # tsc -b (no emit); the build runs this first, so a green build means types pass
```

No linter or CI is configured. Tests run on **Vitest** (`npm test` watch, `npm run test:run` once). **Business logic is what gets tested**: the pure functions (`resolveCallings`, `interpolatePosition`, `beatsForStep`/`buildCallings`, `resolveTrackMeta`, `bpmFromTaps`) and the player phase transitions / gap / hold. UI components and Spotify network calls are not tested — `usePlayerEngine.test.ts` mocks `src/spotify/api.ts` and drives the engine's two timers with `vi.useFakeTimers()` + `advanceTimersByTimeAsync`. Test files (`*.test.ts`) are excluded from the production build in `tsconfig.app.json`, so they are type-checked by Vitest, not `tsc -b`.

Requires a `.env` (gitignored): `cp .env.example .env` and set `VITE_SPOTIFY_CLIENT_ID`. Without it the app renders a "Setup needed" screen (`IS_CONFIGURED` gate in `src/config.ts`). The Client ID is a public identifier, not a secret.

## The one architectural idea that explains everything

The app is a **client-only, offline-first PWA** — there is no backend of our own. It builds to static assets in `dist/` (with a generated service worker) deployable to any static host, and should keep working offline wherever it can: the shell, track list, and authored callings must not depend on the network. Only the live Spotify control/position calls require connectivity; degrade gracefully when they're unavailable rather than blocking the UI. In practice: the service-worker precache (shell + JS/CSS + icon/manifest + a navigation fallback) loads the app offline, and routines/favorites/calibration come from `localStorage`, so the list and editor work offline. `useOnline` drives an offline banner, gates the metadata/resume fetches, and suppresses their errors while offline; `LoginScreen` disables login offline.

This PWA is a **Spotify Connect remote — it never plays audio itself.** The iPhone running the PWA sends Web-API commands to Spotify's cloud, which controls a *separate* device (an Android tablet running the Spotify app, Premium) that plays audio to a Bluetooth speaker. This exists because Spotify's Web Playback SDK does not work on iOS Safari, so a PWA cannot stream Spotify directly. Every design constraint below follows from this:

- **No backend.** Auth is client-side Authorization Code + PKCE (`src/spotify/auth.ts`), tokens in `localStorage`, refreshed transparently in `getAccessToken()`. The redirect URI is derived from `window.location.origin + '/callback'`, so each deploy origin must be registered in the Spotify dashboard.
- **Position is polled, not streamed.** `GET /me/player` (`getPlaybackState`) returns `progress_ms` at poll time. The engine **interpolates** between polls (`progress_ms + (now − fetchedAt)`, the pure `interpolatePosition` helper in `src/playback/position.ts`) for a smooth display. Expect ~½–1s jitter plus Bluetooth audio latency — the **Sync offset** slider in `PlayerScreen` (persisted to `localStorage`) calibrates the constant lag by shifting the position used for calling resolution. Evaluating this precision is the prototype's open question.
- **Spotify access is behind `src/spotify/api.ts`** (devices, play/pause/seek, playback state) so a different audio source could replace it without touching the UI.

## How the player engine works (`src/hooks/usePlayerEngine.ts`)

This hook is the core and the trickiest file. It runs a phase state machine: `idle → loading → playing → (paused | gap | held | ended)`.

- **Two timers:** a 1s **poller** fetches authoritative state from Spotify; a 100ms **ticker** interpolates the displayed position and runs the gap countdown. Both read mutable **refs** (`phaseRef`, `indexRef`, `autoRef`, `snapshotRef`) so they always see fresh values without being torn down and recreated on every state change — when editing, keep each `setX` paired with its `xRef.current = ` update.
- **Track-end detection** is heuristic (no native "ended" event): the ticker triggers when interpolated position reaches `duration − 500ms`; the poller also triggers if Spotify reports `!isPlaying` within 2s of the end.
- **20s gap + permanent pause** are both here: on track end, if `autoContinue` is on it enters `gap` (countdown then auto-advance); otherwise `held`. `holdNow()` is the "pause permanently between tracks" button. UI overlays for `gap`/`held` live in `PlayerScreen`.

## Calling data (the routines)

Steps are authored **musically, not in seconds**. In `src/data/tracks.ts` each track has a `firstBeatSec`, a `bpm` (optional), and `steps: { step, cue, measures }[]` where `measures` is the step's length in 8-counts (halves allowed). The `spotifyUri` values are `REPLACE_ME` placeholders to swap for real track URIs.

**Private track lists:** `tracks.ts` exports `TRACKS` via an `import.meta.glob` loader — if a **gitignored** `src/data/tracks.local.ts` exists (exporting `TRACKS: Track[]`, see `tracks.local.example.ts`) it fully replaces the committed `DEFAULT_TRACKS`; otherwise (CI, Docker, fresh clone) the defaults are used. So coaches keep real routines uncommitted; the glob means a missing file never breaks the build.

At **runtime**, a localStorage override (`tjf.tracks`, `src/data/tracksStore.ts`) takes precedence over the code-defined `TRACKS`: `App` lifts the routine list into state seeded from the store (guarded by `validateTracks`), and the **Routines panel** (`RoutinesManager`) imports/exports the list as JSON and resets back to the code-defined set. `validateTracks` (`src/data/validateTracks.ts`) gates imports (dup ids = error, dup URIs = warning); `collectStepLibrary` (`src/data/stepLibrary.ts`) derives the distinct-move palette for the upcoming step editor.

The seconds-based timeline is **derived**, not stored:

- `src/data/beats.ts#beatsForStep(measures)` — one measure ("Takt") = a full 8-count, so a step is `measures × 8` beats (halves fall out: 2.5 → 20). Step lengths never shrink, so the derived timeline doesn't drift across a track. This convention is the project's domain rule — keep it in sync with `src/data/tracks.ts`'s doc comment.
- `buildCallings(steps, firstBeatSec, bpm)` accumulates beats → absolute-time `Calling[]`.
- Track metadata is **mostly fetched from Spotify**, not authored: only `id`, `spotifyUri`, and `steps` are required; `title`/`artist`/`durationMs`/`firstBeatSec`/`bpm` are optional overrides. `useTrackMeta` (player) + the pure `resolveTrackMeta` (`src/data/meta.ts`, authored-wins-over-fetched) resolve them. Title/artist/duration come from the single `/tracks/{id}` endpoint (reliable). BPM and first beat are normally **tapped in by the coach** (`src/data/calibration.ts`, `bpmFromTaps` + a "mark first beat" capture, saved to `localStorage` per URI via `useCalibration`) because Spotify's `/audio-features` and `/audio-analysis` are **deprecated and 403 for newer apps**; those endpoints are still tried as a best-effort auto-fill. Resolution priority is **authored (`tracks.ts`) > saved tap calibration > Spotify fetch > default**, folded together in `useTrackMeta`. `TrackList` resolves the whole list via `getTracksInfo`, which fans out **parallel single `getTrackInfo` calls** — the multi-get `/tracks?ids=` endpoint is **403 for newer dev-mode apps**, so don't reintroduce it.
- `PlayerScreen` memoizes `buildCallings(track.steps, meta.firstBeatSec, meta.bpm)` and feeds the `Calling[]` to `resolveCallings`. The progress bar uses the **live** duration the engine exposes (`engine.durationMs`, from the Spotify snapshot), falling back to `meta.durationMs`.
- `src/data/callings.ts#resolveCallings(callings, positionSeconds)` maps a position to current/next calling + countdown; `CallingDisplay` and the coach timeline both derive from it.

## Navigation

No router library. `src/App.tsx` switches views with local state (`list` ⇄ `player`) and special-cases the `/callback` path to complete the OAuth exchange before rendering.

## Functions

Grouped by theme; unchecked entries are backlog. **Checked = built, type-checked, lint-clean, unit-tested and committed** — but Spotify-API paths are tested with mocks, so not every checked item has been verified against the live Spotify API or in a real offline browser. Caveats are noted inline.

### Authoring routines (highest leverage — today it's hand-edited TS)
- [x] **In-app step editor.** Add/edit/reorder `steps` (step, cue, measures) from the UI instead of `tracks.ts`/`tracks.local.ts`; persist to `localStorage`. (`TrackEditor` + `tracksStore`; stored as one `tjf.tracks` list override — not per-URI; plus in-app Spotify search, step-library block-insert, BPM guidance.)
- [x] **Import/export routines as JSON.** Back up and share `tracks.local.ts` content without git; download/upload a file. Mitigates the gitignored-and-only-on-one-device risk. (`RoutinesManager` + `validateTracks`.)
- [x] **Live re-time while authoring.** "Mark step boundary" tap mode during playback that fills `measures` from the music, the way first-beat capture already works. (`TapToTime` + `tapsToTiming`.)
- [ ] **Validate routine vs. track length.** Warn when accumulated callings overshoot/undershoot `durationMs` so a mis-typed `measures` is caught before class.
- [ ] Allow json import files in the public folder from webserver and show them dynamicly as recommendend import targets in the UI. By this we can replace fully the TRACKS object from tracks.ts and tracks.local.ts and just load default.json and default.*.json files on startup.
- [ ] Allow marking tracks as WORK IN PROGRESS (timings for example are not finished)

### Class / session flow
- [ ] **Setlist mode.** Order several tracks into a session and auto-advance through them (the 20s gap already exists per-track; extend to a queue with total session time + remaining estimate).
- [ ] **Auto-calibrate Bluetooth latency** instead of a manual slider. But how?

### Coach-facing display
- [ ] **Stage / big-display mode.** Maximize the current + next cue for visibility across a studio; minimal chrome.
- [ ] **Haptic / vibration cue** on step change (Vibration API).
- [ ] **Mirror / left-right labeling** for cues so the coach can call mirrored to the class.
- [ ] **Beat-grid / count visualization** (1-2-3-4-5-6-7-8) ticking with the music, driven by `bpm` + `firstBeatSec`.

### Robustness & offline
- [x] **Reconnect / device-lost handling.** Surface when the target Connect device disappears or playback is hijacked by another app, with a one-tap re-target. (engine `noDevice` + `hijacked` + `recover()`, two recovery banners — detects both the device *disappearing* (empty polls) and another app *hijacking* the session (a foreign track plays for `HIJACK_POLLS` polls). Unit-tested with mocks, not against a live device.)
- [x] **Token-expiry UX.** Graceful re-auth when the refresh fails mid-class rather than a silent stall. (`AUTH_EXPIRED_EVENT` → login screen; plus `startTokenAutoRefresh` proactive background refresh.)
- [x] **Offline audit.** Verify the shell, track list, and authored callings truly work offline (matches the stated offline-first goal). (`useOnline` banner + gated fetches; precache manifest **inspected** — not yet confirmed in a live offline browser session.)
- [ ] **PWA install prompt / affordance.** (the offline audit half of the old combined item is done; the install prompt remains.)
- [ ] **Fast loading search insert bar.** Hard code some search results and display them opening a search without text for quick access the most popular 20 jumping fitness songs offline.
- [ ] Can we make the progress bar circle has more units, so that it flows more?

### Track list UX
- [x] **Search / filter / favorites** in `TrackList` as the list grows. (search box + `useOnline`-aware filtering, starred favorites in `tjf.favorites`.)
- [x] **Seed tracks from a Spotify playlist** (one call to import URIs, then author steps). (`PlaylistSeed` → routine stubs with BPM-if-known.)

### Engineering / quality
- [ ] **Component tests** for `PlayerScreen` gap/held overlays and `CallingDisplay` (currently only business logic is tested).
- [x] **Wire up ESLint in CI** (config was added; make it run on PRs). (`.github/workflows/ci.yml` runs typecheck/lint/test/build on push + PR.)
- [ ] **Revisit track-end heuristic** (`duration − 500ms`) — make the threshold configurable or smarter to avoid early/late gap entry on tracks with long outros.

### Features
- [ ] Add a link that can be shared to the crowd for survey next song (15s).
- [ ] Find an API to parse "First beat (s)" from song. Maybe there is a free pass (10 querys per day we can cache and use over some days to save money)
- [ ] Add url path for view of song detail page.
