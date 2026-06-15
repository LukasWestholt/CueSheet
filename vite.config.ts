import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      // Precache the routine JSON too so the default set (and import targets)
      // load offline — they're the app's data, not just static assets.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
      },
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