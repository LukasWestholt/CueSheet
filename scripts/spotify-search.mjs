#!/usr/bin/env node
// Search Spotify for tracks and print their id / uri / name / artist / duration.
// Handy for filling in `spotifyUri` values in src/data/tracks.ts.
//
// Usage:
//   node scripts/spotify-search.mjs "low flo rida"
//   node scripts/spotify-search.mjs --limit 5 barbie girl tiesto
//
// Auth (search needs no user login):
//   - Preferred: client-credentials — set SPOTIFY_CLIENT_SECRET in .env
//     alongside VITE_SPOTIFY_CLIENT_ID (your existing Spotify app).
//   - Fallback: SPOTIFY_ACCESS_TOKEN — paste the access_token from the web
//     app's localStorage key "tjf.spotify.tokens" for a quick one-off.

import { readFileSync } from 'node:fs';

function loadDotEnv() {
  try {
    const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* no .env — rely on real env vars */
  }
}

async function getToken() {
  if (process.env.SPOTIFY_ACCESS_TOKEN) return process.env.SPOTIFY_ACCESS_TOKEN;
  const id = process.env.VITE_SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      'No credentials. Set SPOTIFY_CLIENT_SECRET in .env (with VITE_SPOTIFY_CLIENT_ID),\n' +
        'or set SPOTIFY_ACCESS_TOKEN to a token copied from the web app.',
    );
  }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

async function main() {
  loadDotEnv();
  const args = process.argv.slice(2);
  let limit = 10;
  const li = args.findIndex((a) => a === '--limit' || a === '-n');
  if (li >= 0) {
    limit = Math.max(1, Math.min(50, Number(args[li + 1]) || 10));
    args.splice(li, 2);
  }
  const query = args.join(' ').trim();
  if (!query) {
    console.error('Usage: node scripts/spotify-search.mjs [--limit N] <search query>');
    process.exit(1);
  }

  const token = await getToken();
  const url =
    'https://api.spotify.com/v1/search?type=track' +
    `&limit=${limit}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Search failed: ${res.status} ${await res.text()}`);

  const items = (await res.json()).tracks?.items ?? [];
  if (items.length === 0) {
    console.log('No results.');
    return;
  }
  for (const t of items) {
    const artists = t.artists.map((a) => a.name).join(', ');
    console.log(`spotify:track:${t.id}  [${formatDuration(t.duration_ms)}]  ${t.name} — ${artists}`);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
