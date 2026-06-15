# Free song BPM (beat) data

Spotify deprecated `audio-features` (tempo) and `audio-analysis` (beat grid) for
apps created after **Nov 2024** — they return **403** for CueSheet, so we can't
get BPM/first-beat from Spotify. BPM is therefore tapped in by the coach
(`bpmFromTaps`). This doc evaluates **free** third-party sources we can use to
*auto-fill* BPM as a fallback, and explains what we chose.

Hard constraint: CueSheet is a **client-only PWA with no backend**, so any
source must be callable from the browser — i.e. it must support **CORS** or
**JSONP**, otherwise it would need a proxy/backend we don't have.

## Options compared

| Source | Free? | Auth | Browser-callable? | Coverage / accuracy | Notes |
|---|---|---|---|---|---|
| **Deezer** | ✅ | none | ⚠️ no CORS, but **JSONP works** | BPM present but **`0` for many tracks** | Lookup by **ISRC** (`/track/isrc:<ISRC>`) or id; returns a `bpm` field. **Chosen.** |
| **GetSongBPM** | ✅ | API key | ✅ CORS | Good | **Fallback behind Deezer** (fills `bpm:0` gaps). **Mandatory backlink** to getsongbpm.com or the account is suspended; needs a key. Attribution UX cost. |
| **AcousticBrainz** | ✅ | none | n/a | n/a | **Dead** — project ended 2022/23 (data-quality issues); no replacement. |
| **TuneBat** | — | — | ❌ | Good | No official public API (scraping only — against ToS). |
| **AcoustID / Chromaprint** | ✅ | key | n/a | n/a | Matches by **audio fingerprint** — we never have the raw audio, so N/A. |
| **Soundcharts / Musicgpt / Mixed-In-Key** | ❌ | key | varies | Good | Paid / commercial. |

## Decision: Deezer by ISRC, via JSONP

- **No key, no backend, no attribution requirement.** Spotify's `/tracks/{id}`
  already gives us the track's **ISRC** (`external_ids.isrc`), and Deezer can be
  queried by ISRC, so we get a stable cross-service match without fuzzy
  title/artist search.
- **CORS:** verified that Deezer's REST responses omit `Access-Control-Allow-Origin`
  (even when an `Origin` header is sent), so a plain `fetch()` is blocked in the
  browser. Deezer **does** support **JSONP** (`?output=jsonp&callback=…`), which
  loads the response via a `<script>` tag and bypasses CORS. That's what we use.
- **Coverage caveat:** Deezer's `bpm` is **`0` for a lot of tracks**. We treat
  `bpm <= 0` (and any error/timeout) as *unknown* and return `null`, so the app
  cleanly falls back to manual tap calibration. This is an auto-*fill*, not a
  source of truth.

## How it's wired in

- `src/beatdata/deezer.ts` — `getBpmByIsrc(isrc)` performs the JSONP request and
  returns a rounded positive BPM or `null`. Self-contained; fails gracefully.
  An `ENABLED` constant lets you turn it off.
- `src/spotify/api.ts` — `getTrackInfo`/`TrackInfo` now also return `isrc`.
- `src/beatdata/getsongbpm.ts` — `getBpmByTitleArtist(title, artist)`, a
  **fallback** behind Deezer for the tracks Deezer reports as `bpm:0`. Plain
  CORS `fetch` (no JSONP), matched by title/artist. **Opt-in:** disabled unless
  `VITE_GETSONGBPM_API_KEY` is set, and GetSongBPM **requires a visible backlink
  to getsongbpm.com** — add one to the UI before shipping it enabled.
- `src/hooks/useTrackMeta.ts` — after fetching track info, if BPM isn't authored
  it tries `getBpmByIsrc(info.isrc)` then `getBpmByTitleArtist(...)`, filling
  `fetched.bpm` **only if not already set**. Final priority stays **authored >
  tap calibration > Deezer → GetSongBPM / Spotify fetch > default**.

## Tradeoffs of JSONP

JSONP injects a `<script>` from `api.deezer.com` and trusts the response — a
mild trust/CSP consideration. It's the standard, long-stable way to call Deezer
from a browser without a backend. If a CSP is ever added, `script-src` must allow
`https://api.deezer.com`. If you later add even a tiny backend/proxy, prefer the
plain JSON endpoint (or GetSongBPM with its key) over JSONP.
