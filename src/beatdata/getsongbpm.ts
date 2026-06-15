// Optional BPM source #2: GetSongBPM (https://getsongbpm.com), a free, CORS-
// enabled tempo database. We use it as a *fallback* behind Deezer (see
// `deezer.ts`): Deezer is keyless but reports `bpm: 0` for many tracks, and
// GetSongBPM has good coverage to fill those gaps. See docs/beat-data.md.
//
// Two costs to be aware of:
//  1. **API key** — free, but required. Set `VITE_GETSONGBPM_API_KEY` in `.env`.
//     Without it this source disables itself (returns null), so the app falls
//     back to Deezer / manual tap calibration exactly as before.
//  2. **Mandatory backlink** — GetSongBPM suspends accounts that don't link back
//     to getsongbpm.com. A visible attribution link must be added to the UI
//     before this is shipped enabled (e.g. in the LoginScreen footer).
//
// Unlike Deezer this matches by **title + artist** (GetSongBPM has no ISRC
// lookup), so it's fuzzier — we take the first search hit. CORS works, so a
// plain fetch() is fine (no JSONP needed); CSP connect-src must allow the host.

import { cached } from '../spotify/metaCache';

const API_KEY: string = import.meta.env.VITE_GETSONGBPM_API_KEY ?? '';
const ENABLED = API_KEY.length > 0;
const BASE = 'https://api.getsongbpm.com';

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
  if (!ENABLED || !title || !artist) return null;
  return cached('getsongbpmBpm', cacheKey(title, artist), async () => {
    try {
      const lookup = encodeURIComponent(`song:${title} artist:${artist}`);
      const res = await fetch(`${BASE}/search/?api_key=${API_KEY}&type=both&lookup=${lookup}`);
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

      const detailRes = await fetch(`${BASE}/song/?api_key=${API_KEY}&id=${encodeURIComponent(first.id)}`);
      if (!detailRes.ok) return null;
      const detail = (await detailRes.json()) as GsbSongResponse;
      return parseTempo(detail.song?.tempo);
    } catch {
      return null;
    }
  });
}