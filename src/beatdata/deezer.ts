// Optional BPM source: Deezer's public API (no key, no backend).
//
// Deezer's REST API does NOT send `Access-Control-Allow-Origin`, so a browser
// `fetch()` is CORS-blocked — but it supports JSONP (`?output=jsonp&callback=`),
// which sidesteps CORS entirely by loading a <script>. We look a track up by
// ISRC (which Spotify gives us via /tracks → external_ids.isrc).
//
// Caveat: Deezer reports `bpm: 0` for many tracks (coverage gaps), so this is a
// best-effort auto-fill that ranks below authored values and tap calibration.
// See docs/beat-data.md for the full comparison of free BPM sources.

import { cached } from '../spotify/metaCache';

const ENABLED = true; // flip to false to disable the Deezer lookup entirely
const JSONP_TIMEOUT_MS = 6000;

let callbackCounter = 0;

/** Loads a Deezer API URL via JSONP (works around the missing CORS headers). */
function deezerJsonp<T>(url: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('JSONP requires a browser document'));
      return;
    }
    const win = window as unknown as Record<string, unknown>;
    const cbName = `__cuesheet_deezer_${Date.now()}_${callbackCounter++}`;
    const script = document.createElement('script');

    const cleanup = () => {
      clearTimeout(timer);
      delete win[cbName];
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Deezer JSONP timed out'));
    }, JSONP_TIMEOUT_MS);

    win[cbName] = (data: T) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('Deezer JSONP failed to load'));
    };
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${cbName}`;
    document.head.appendChild(script);
  });
}

interface DeezerTrack {
  bpm?: number;
  error?: unknown;
}

/**
 * Looks up a track's BPM by ISRC via Deezer. Returns a rounded positive BPM, or
 * null when unknown (Deezer's `bpm` is 0 for many tracks) or on any failure.
 */
export async function getBpmByIsrc(isrc: string | null | undefined): Promise<number | null> {
  if (!ENABLED || !isrc) return null;
  // Cache by ISRC (memory + localStorage). Only positive BPMs are cached, so a
  // track Deezer has no tempo for (or a transient failure) stays retriable.
  return cached('deezerBpm', isrc, async () => {
    try {
      const data = await deezerJsonp<DeezerTrack>(
        `https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`,
      );
      if (data.error) return null;
      return typeof data.bpm === 'number' && data.bpm > 0 ? Math.round(data.bpm) : null;
    } catch {
      return null;
    }
  });
}
