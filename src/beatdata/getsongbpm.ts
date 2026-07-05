// Optional BPM source #2: GetSongBPM (https://getsongbpm.com), a free, CORS-
// enabled tempo database. We use it as a *fallback* behind Deezer (see
// `deezer.ts`): Deezer is keyless but reports `bpm: 0` for many tracks, and
// GetSongBPM has good coverage to fill those gaps. See docs/beat-data.md.
//
// Two costs to be aware of:
//  1. **API key** — free, but required. A static site can't hide a secret, so
//     the key is **per-user**: pasted in Settings (or via a `?getsongbpm_key=`
//     bookmark) and kept in localStorage (`src/data/getsongbpmKey.ts`), never
//     in the bundle. Without a key this source disables itself (returns null),
//     so the app falls back to Deezer / manually tapped timing exactly as before.
//  2. **Mandatory backlink** — GetSongBPM suspends accounts that don't link
//     back to getsongbpm.com, and verifies it by reading the *raw source HTML*
//     (React-rendered nodes don't count). So the backlink is a static <a> in
//     `index.html` (outside #root); the LoginScreen footer also links out for
//     humans.
//
// Unlike Deezer this matches by **title + artist** (GetSongBPM has no ISRC
// lookup), so it's fuzzier — we take the first search hit. CORS works, so a
// plain fetch() is fine (no JSONP needed); CSP connect-src must allow the host.
//
// Host note: `https://api.getsong.co` is the official Web API base URL (per the
// API docs / changelog v1.2, Sep 2024). The old `api.getsongbpm.com` host only
// 301-redirects here and sits behind a Cloudflare bot challenge, so we call
// getsong.co directly — a programmatic fetch then skips both the challenge and a
// CSP redirect block, and gets `Access-Control-Allow-Origin: *`. Auth is the
// `api_key` query param (rate limit 3000 req/hour). Quirk: it returns JSON but
// mislabels it `Content-Type: text/html`, so never gate on content-type — parse
// defensively.

import { cached } from '../spotify/metaCache';
import { loadGetsongbpmKey } from '../data/getsongbpmKey';

const BASE = 'https://api.getsong.co';

interface GsbSong {
  id?: string;
  tempo?: string | number;
}
interface GsbSearchResponse {
  search?: GsbSong[] | { error?: string };
  error?: string;
}
interface GsbSongResponse {
  song?: GsbSong;
  error?: string;
}

function parseTempo(value: string | number | undefined): number | null {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Stable cache key: lowercased "title|artist", whitespace collapsed. */
function cacheKey(title: string, artist: string): string {
  return `${title}|${artist}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Looks up a track's BPM by title + artist via GetSongBPM. Returns a rounded
 * positive BPM, or null when disabled (no key), not found, or on any failure.
 */
export async function getBpmByTitleArtist(
  title: string | null | undefined,
  artist: string | null | undefined,
): Promise<number | null> {
  const apiKey = loadGetsongbpmKey();
  if (!apiKey || !title || !artist) return null;
  return cached('getsongbpmBpm', cacheKey(title, artist), async () => {
    try {
      const lookup = encodeURIComponent(`song:${title} artist:${artist}`);
      const res = await fetch(`${BASE}/search/?api_key=${apiKey}&type=both&lookup=${lookup}`);
      if (!res.ok) return null;
      const data = (await res.json()) as GsbSearchResponse;
      const list = Array.isArray(data.search) ? data.search : [];
      const first = list[0];
      if (!first) return null;

      // The search hit usually carries `tempo` directly; if it doesn't, fetch
      // the song detail by id as a fallback.
      const direct = parseTempo(first.tempo);
      if (direct != null) return direct;
      if (!first.id) return null;

      const detailRes = await fetch(`${BASE}/song/?api_key=${apiKey}&id=${encodeURIComponent(first.id)}`);
      if (!detailRes.ok) return null;
      const detail = (await detailRes.json()) as GsbSongResponse;
      return parseTempo(detail.song?.tempo);
    } catch {
      return null;
    }
  });
}

export type GsbKeyTestResult = { ok: true } | { ok: false; reason: string };

/**
 * Pings GetSongBPM with the given key to confirm it's valid and activated.
 * Uses a well-known query (Adele – Hello) so a successful key is very likely
 * to return a hit. Bypasses the cache (this is a connectivity/auth check, not a
 * lookup). Returns a friendly reason string on failure.
 */
export async function testGetsongbpmKey(key: string): Promise<GsbKeyTestResult> {
  const apiKey = key.trim();
  if (!apiKey) return { ok: false, reason: 'Enter a key first.' };
  try {
    const lookup = encodeURIComponent('song:hello artist:adele');
    const res = await fetch(`${BASE}/search/?api_key=${apiKey}&type=both&lookup=${lookup}`);
    // The backend returns JSON but mislabels it `text/html`, and a bot challenge
    // would return a real HTML page — so parse defensively rather than trusting
    // Content-Type or status alone. A clean rejection reads:
    //   HTTP 401  {"error":"Invalid API Key, or inactive."}
    const body = await res.text();
    let data: GsbSearchResponse;
    try {
      data = JSON.parse(body) as GsbSearchResponse;
    } catch {
      return {
        ok: false,
        reason: 'Could not reach the GetSongBPM API (blocked or unavailable). Try again from the app on your device.',
      };
    }
    if (typeof data.error === 'string' && data.error) {
      return { ok: false, reason: data.error };
    }
    if (!res.ok) return { ok: false, reason: `Request failed (HTTP ${res.status}).` };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Network error — check your connection.' };
  }
}