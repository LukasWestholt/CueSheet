---
name: spotify-search
description: Search Spotify for track ids / URIs by a text query (artist, title, etc.). Use when the user wants to find a Spotify track URI to add to src/data/tracks.ts, or asks to "search Spotify for <song>".
---

# Spotify track search

Finds Spotify tracks for a query and prints `spotify:track:<id>` URIs ready to
paste into `src/data/tracks.ts`.

## How to run

```bash
node scripts/spotify-search.mjs [--limit N] <query>
```

Examples:

```bash
node scripts/spotify-search.mjs "low flo rida"
node scripts/spotify-search.mjs --limit 5 barbie girl tiesto
```

Each result line is: `spotify:track:<id>  [m:ss]  <title> — <artist>`.

## Auth (search needs no user login)

The script gets its own token; pick whichever the repo already has:

- **Preferred — client credentials:** add `SPOTIFY_CLIENT_SECRET=...` to `.env`
  next to the existing `VITE_SPOTIFY_CLIENT_ID` (same Spotify app, dashboard →
  your app → Settings → "View client secret"). `.env` is gitignored. This is
  set-and-forget; the script fetches a fresh app token each run.
- **Fallback — paste a web token:** set `SPOTIFY_ACCESS_TOKEN` to the
  `access_token` from the web app's `localStorage` key `tjf.spotify.tokens`
  (DevTools → Application → Local Storage). Expires after ~1 hour.

If neither is set, the script prints a message saying what to add.

## When using this skill

1. Run the script with the user's query (default 10 results; pass `--limit` if
   they want more/fewer).
2. Relay the result lines, and offer to drop a chosen `spotify:track:...` into
   the relevant track in `src/data/tracks.ts`.
3. If it errors about missing credentials, tell the user to add
   `SPOTIFY_CLIENT_SECRET` to `.env` (one-time) and retry.