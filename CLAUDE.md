# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server on http://127.0.0.1:5173 (host is 127.0.0.1, not localhost — Spotify only accepts loopback-IP redirect URIs)
npm run build      # tsc -b && vite build  → dist/ (also generates the PWA service worker)
npm run preview    # serve the production build
npm run typecheck  # tsc -b (no emit); the build runs this first, so a green build means types pass
```

No linter or CI is configured. Tests run on **Vitest** (`npm test` watch, `npm run test:run` once). **Business logic is what gets tested**: the pure functions (`resolveCallings`, `interpolatePosition`, `beatsForStep`/`buildCallings`, `resolveTrackMeta`) and the player phase transitions / gap / hold. UI components and Spotify network calls are not tested — `usePlayerEngine.test.ts` mocks `src/spotify/api.ts` and drives the engine's two timers with `vi.useFakeTimers()` + `advanceTimersByTimeAsync`. Test files (`*.test.ts`) are excluded from the production build in `tsconfig.app.json`, so they are type-checked by Vitest, not `tsc -b`.

Requires a `.env` (gitignored): `cp .env.example .env` and set `VITE_SPOTIFY_CLIENT_ID`. Without it the app renders a "Setup needed" screen (`IS_CONFIGURED` gate in `src/config.ts`). The Client ID is a public identifier, not a secret.

## The one architectural idea that explains everything

The app is a **client-only, offline-first PWA** — there is no backend of our own. It builds to static assets in `dist/` (with a generated service worker) deployable to any static host, and should keep working offline wherever it can: the shell, track list, and authored callings must not depend on the network. Only the live Spotify control/position calls require connectivity; degrade gracefully when they're unavailable rather than blocking the UI.

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

The seconds-based timeline is **derived**, not stored:

- `src/data/beats.ts#beatsForStep(measures)` — one measure ("Takt") = a full 8-count, so a step is `measures × 8` beats (halves fall out: 2.5 → 20). Step lengths never shrink, so the derived timeline doesn't drift across a track. This convention is the project's domain rule — keep it in sync with `src/data/tracks.ts`'s doc comment.
- `buildCallings(steps, firstBeatSec, bpm)` accumulates beats → absolute-time `Calling[]`.
- Track metadata is **mostly fetched from Spotify**, not authored: only `id`, `spotifyUri`, and `steps` are required; `title`/`artist`/`durationMs`/`firstBeatSec`/`bpm` are optional overrides. `useTrackMeta` (player) + the pure `resolveTrackMeta` (`src/data/meta.ts`, authored-wins-over-fetched) resolve them. Title/artist/duration come from the single `/tracks/{id}` endpoint (reliable); BPM (`/audio-features`) and first beat (`/audio-analysis`, `bars[0].start`) are **best-effort — deprecated for apps created after Nov 2024 and may 403**, so manual values stay the fallback. `TrackList` resolves the whole list via `getTracksInfo`, which fans out **parallel single `getTrackInfo` calls** — the multi-get `/tracks?ids=` endpoint is **403 for newer dev-mode apps**, so don't reintroduce it.
- `PlayerScreen` memoizes `buildCallings(track.steps, meta.firstBeatSec, meta.bpm)` and feeds the `Calling[]` to `resolveCallings`. The progress bar uses the **live** duration the engine exposes (`engine.durationMs`, from the Spotify snapshot), falling back to `meta.durationMs`.
- `src/data/callings.ts#resolveCallings(callings, positionSeconds)` maps a position to current/next calling + countdown; `CallingDisplay` and the coach timeline both derive from it.

## Navigation

No router library. `src/App.tsx` switches views with local state (`list` ⇄ `player`) and special-cases the `/callback` path to complete the OAuth exchange before rendering.
