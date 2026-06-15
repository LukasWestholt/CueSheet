import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// vite.config.ts runs in Node; declare the one global we read here so tsc -b
// doesn't need @types/node just for this.
declare const process: { env: Record<string, string | undefined> };

// https://vite.dev/config/
export default defineConfig({
  // Public base path. Defaults to '/' (dev, the Docker/nginx image, tests); the
  // GitHub Pages project deploy overrides it via BASE_PATH=/CueSheet/. Vite
  // normalizes a trailing slash, and import.meta.env.BASE_URL reflects it at
  // runtime (used by the /callback redirect URI — see src/config.ts).
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'CueSheet',
        short_name: 'CueSheet',
        description:
          'CueSheet turns your Spotify playlist into a timed cue sheet, calling each jumping-fitness step in time with the music.',
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
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