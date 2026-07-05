import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// vite.config.ts runs in Node; declare the one global we read here so tsc -b
// doesn't need @types/node just for this.
declare const process: { env: Record<string, string | undefined> };

// https://vite.dev/config/
export default defineConfig({
  // Inline the package.json version (set by npm when running scripts) as a build
  // constant — surfaced in the UI. See src/version.ts + the global in vite-env.d.ts.
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
  },
  // Public base path. Defaults to '/' (dev, the Docker/nginx image, tests); the
  // GitHub Pages project deploy overrides it via BASE_PATH=/CueSheet/. Vite
  // normalizes a trailing slash, and import.meta.env.BASE_URL reflects it at
  // runtime (used by the /callback redirect URI — see src/config.ts).
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      // Precache the routine JSON too so the default set (and import targets)
      // load offline — they're the app's data, not just static assets.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,woff2,png}'],
        // Album art (Spotify CDN) is immutable per URL — cache-first with a
        // bounded store so covers appear instantly and survive offline. API
        // calls are deliberately NOT runtime-cached (live playback state).
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(i|mosaic)\.scdn\.co\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'spotify-art',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
        ],
      },
      manifest: {
        name: 'CueSheet',
        short_name: 'CueSheet',
        description:
          'CueSheet turns your Spotify playlist into a timed cue sheet, calling each jumping-fitness step in time with the music.',
        theme_color: '#121821',
        background_color: '#121821',
        display: 'standalone',
        orientation: 'portrait',
        // Android (WebAPK) captures in-scope links — a shared /session/… or
        // /track/:id opens the installed app; navigate-existing reuses the
        // open window instead of stacking new ones. iOS has no PWA link
        // capturing at all: there, shared links open in the browser, and the
        // login flow carries the deep link through OAuth (src/spotify/auth.ts)
        // so a logged-out browser still lands on the shared session.
        launch_handler: { client_mode: 'navigate-existing' },
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Full-bleed, art inside the safe zone — Android launchers crop
          // this into circles/squircles.
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Home-screen long-press shortcut (Android/desktop; iOS ignores it).
        // Relative URL → resolves against the manifest scope, so it works on
        // sub-path deploys too. /session opens the saved setlist ready to play.
        shortcuts: [
          {
            name: 'Start setlist session',
            short_name: 'Setlist',
            description: 'Open your saved setlist ready to start',
            url: 'session',
          },
        ],
      },
    }),
  ],
  server: {
    // Spotify allows http://127.0.0.1 as a loopback redirect URI for dev.
    host: '127.0.0.1',
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Don't run duplicated tests from git worktrees created under .claude/.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});