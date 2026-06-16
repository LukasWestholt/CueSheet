import type { Track } from './tracks';
import { readJSON, writeJSON, removeKey } from './storage';

// Runtime override for the routine list: imported/edited routines are stored
// here so they drive the app without touching the committed routine JSON.
// When absent, the app falls back to the public-folder default set (or the
// code-defined TRACKS when offline before precache).
const KEY = 'tjf.tracks';

export function loadStoredTracks(): Track[] | null {
  return readJSON<Track[] | null>(KEY, null, (data) =>
    Array.isArray(data) ? (data as Track[]) : null,
  );
}

export function saveStoredTracks(tracks: Track[]): void {
  writeJSON(KEY, tracks);
}

export function clearStoredTracks(): void {
  removeKey(KEY);
}

/** Pretty JSON for export/download. */
export function serializeTracks(tracks: Track[]): string {
  return JSON.stringify(tracks, null, 2);
}
