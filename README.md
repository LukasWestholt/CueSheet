# CueSheet

CueSheet turns your Spotify playlist into a timed cue sheet, calling each
jumping-fitness step in time with the music.

It's a mobile PWA for jumping-fitness coaches: it shows a list of tracks; each
track opens a player that displays the **prepared order of step callings** synced
to the music, with a big "NOW / NEXT + countdown" display you can read from the
trampoline.

## Architecture

The PWA does **not** play audio itself. It acts as a **Spotify Connect remote**:

```
iPhone PWA (this app)  --commands/position-->  Spotify Cloud  --->  Android tablet
   list + synced                                                    (Spotify app, Premium)
   calling display                                                        |
                                                                          v  Bluetooth
                                                                     🔊 Speaker
```

This sidesteps the fact that Spotify's Web Playback SDK doesn't work on iOS
Safari: the iPhone only sends Web-API commands (`fetch`) and reads the playback
position, while the tablet plays the audio to a Bluetooth speaker.

Playback position is **interpolated** between polls
(`progress_ms + (now − fetchedAt)`) so the calling display stays smooth, and a
**Sync offset** slider compensates for Bluetooth audio latency.

> Precision note: position comes from polling `GET /me/player`, so expect ~½–1s
> jitter plus Bluetooth latency. The on-screen `debug` line + sync slider let you
> evaluate and calibrate this — that's the open question this prototype tests.

## Setup

1. Create a free app in the [Spotify dashboard](https://developer.spotify.com/dashboard).
2. Add these Redirect URIs to the app:
   - `http://127.0.0.1:5173/callback` (local dev)
   - `https://<your-deployed-domain>/callback` (production / iPhone)
3. Copy the env file and paste your Client ID:
   ```bash
   cp .env.example .env
   # edit .env -> VITE_SPOTIFY_CLIENT_ID=...
   ```
4. Install + run:
   ```bash
   npm install
   npm run dev      # http://127.0.0.1:5173
   ```

## Run with Docker

A multi-stage image (Vite build → nginx) is published to GHCR on every push to
`main` by `.github/workflows/docker.yml`. Pull and run it:

```bash
docker run --rm -p 8080:80 ghcr.io/lukaswestholt/cuesheet:main
# then open http://127.0.0.1:8080
```

Podman is a drop-in replacement (`podman run --rm -p 8080:80 ghcr.io/lukaswestholt/cuesheet:main`).

> **Client ID is baked at build time.** Vite inlines `VITE_SPOTIFY_CLIENT_ID`
> into the static bundle during `npm run build`, so the published image only has
> a Client ID if the repo's `VITE_SPOTIFY_CLIENT_ID` variable was set when it was
> built. Without one the app loads but shows the "Setup needed" screen. To bake
> your own, build locally:
>
> ```bash
> docker build --build-arg VITE_SPOTIFY_CLIENT_ID=your_client_id -t cuesheet .
> docker run --rm -p 8080:80 cuesheet
> ```

Register the origin you serve from as a redirect URI in the Spotify dashboard —
`http://127.0.0.1:8080/callback` works because Spotify allows loopback-IP URIs
without HTTPS (use `127.0.0.1`, not `localhost`). The container serves on port
`80`; map it to whatever host port you like.

## Testing the Spotify sync

- You need **Spotify Premium** on the device that plays audio.
- Open the Spotify app on your **Android tablet**, play anything once so it
  appears as a Connect device, then pick it in the app's **device picker**.
- Replace the placeholder `spotifyUri` values in `src/data/tracks.ts` with real
  track URIs (Spotify app → Share → Copy Spotify URI).

## Using it on the iPhone

The PWA needs HTTPS for OAuth + install. Deploy `npm run build`'s `dist/` to any
static host (Netlify/Vercel/Cloudflare Pages), add that domain's `/callback` to
the Spotify app, then "Add to Home Screen" in Safari.

## Editing the routine

Each track in `src/data/tracks.ts` has a `callings` array — `{ time, step, cue }`
where `time` is seconds from the start. Keep it sorted by `time`.

## Project layout

```
src/
  config.ts              Client ID + redirect + scopes
  spotify/auth.ts        PKCE login, token storage/refresh
  spotify/api.ts         Web API: devices, play/pause/seek, playback state
  data/tracks.ts         Track + Calling model + mock data (edit me)
  data/callings.ts       resolve current/next calling at a position
  hooks/usePlayerEngine  polling, interpolation, 20s gap, permanent pause
  hooks/useWakeLock      keep screen awake during class
  components/            LoginScreen, TrackList, DevicePicker,
                         PlayerScreen, CallingDisplay
```
