import type { Track } from './tracks';

// Runtime override for the routine list: imported/edited routines are stored
// here so they drive the app without touching tracks.ts / tracks.local.ts.
// When absent, the app falls back to the code-defined TRACKS.
const KEY = 'tjf.tracks';

export function loadStoredTracks(): Track[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as Track[]) : null;
  } catch {
    return null;
  }
}

export function saveStoredTracks(tracks: Track[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tracks));
  } catch {
    /* storage full / unavailable — the in-memory list still works this session */
  }
}

export function clearStoredTracks(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Pretty JSON for export/download. */
export function serializeTracks(tracks: Track[]): string {
  return JSON.stringify(tracks, null, 2);
}
