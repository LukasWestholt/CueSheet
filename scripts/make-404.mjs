// GitHub Pages serves 404.html for any unknown path. Copy the built index.html
// to dist/404.html so SPA deep links (e.g. /track/:id) boot the app and let it
// resolve the route client-side, instead of returning a hard 404.
//
// Harmless elsewhere: nginx (Docker) and the vite dev server already fall back
// to index.html, so the extra file just goes unused.
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const index = resolve(root, 'dist', 'index.html');
const notFound = resolve(root, 'dist', '404.html');

if (existsSync(index)) {
  copyFileSync(index, notFound);
  console.log('Wrote dist/404.html (SPA fallback for GitHub Pages).');
} else {
  console.warn('dist/index.html not found — skipped 404.html.');
}
