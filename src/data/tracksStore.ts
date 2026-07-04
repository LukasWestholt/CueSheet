import type { Track } from './tracks';
import { readJSON, writeJSON, removeKey, readFlag, writeFlag } from './storage';

// Runtime override for the routine list: imported/edited routines are stored
// here so they drive the app without touching the committed routine JSON.
// When absent, the app falls back to the public-folder default set (or the
// code-defined TRACKS when offline before precache).
const KEY = 'tjf.tracks';
// One-time migration marker: see loadStoredTracks.
const ZERO_FIRSTBEAT_CLEANED = 'tjf.zeroFirstBeatCleaned';

/** The track without a `firstBeatSec: 0` (same object when there's none). */
function withoutZeroFirstBeat(t: Track): Track {
  if (t.firstBeatSec !== 0) return t;
  const copy = { ...t };
  delete copy.firstBeatSec;
  return copy;
}

export function loadStoredTracks(): Track[] | null {
  const tracks = readJSON<Track[] | null>(KEY, null, (data) =>
    Array.isArray(data) ? (data as Track[]) : null,
  );
  if (tracks == null) return null;
  // One-time migration: lists materialized from the old playbook carry
  // `firstBeatSec: 0` on tracks that never authored one (those zeros were
  // later stripped from the playbook because an authored 0 disables the
  // player's "Mark first beat" capture). Clean them once. A 0 the coach
  // types *after* this is deliberate: it stays, and exports faithfully.
  if (!readFlag(ZERO_FIRSTBEAT_CLEANED)) {
    writeFlag(ZERO_FIRSTBEAT_CLEANED, true);
    if (tracks.some((t) => t.firstBeatSec === 0)) {
      const cleaned = tracks.map(withoutZeroFirstBeat);
      saveStoredTracks(cleaned);
      return cleaned;
    }
  }
  return tracks;
}

export function saveStoredTracks(tracks: Track[]): void {
  writeJSON(KEY, tracks);
}

export function clearStoredTracks(): void {
  removeKey(KEY);
}

/**
 * Pretty JSON for export/download — faithful to the stored list. Legacy
 * `firstBeatSec: 0` pollution is cleaned at load time (see loadStoredTracks),
 * so a 0 that's still here was set on purpose and must survive the round-trip.
 */
export function serializeTracks(tracks: Track[]): string {
  return JSON.stringify(tracks, null, 2);
}
