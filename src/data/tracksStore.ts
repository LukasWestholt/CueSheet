import type { Track } from './tracks';
import { readJSON, writeJSON, removeKey, readFlag, writeFlag, keysWithPrefix } from './storage';

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

// Legacy per-device tap-calibration store (`tjf.cal.<uri>` → {bpm, firstBeatSec}).
// Retired 2026-07 when the timing flow moved into the editor and started
// writing straight into the routine — see foldLegacyCalibration.
const CAL_PREFIX = 'tjf.cal.';

/**
 * One-time migration: fold the legacy per-device calibration into the stored
 * routine list (authored values win — only missing bpm/firstBeatSec are
 * filled), then delete the store. Returns the folded list, or null when there
 * was nothing to migrate.
 */
function foldLegacyCalibration(tracks: Track[]): Track[] | null {
  const keys = keysWithPrefix(CAL_PREFIX);
  if (keys.length === 0) return null;
  const cals = new Map<string, { bpm?: number; firstBeatSec?: number }>();
  for (const k of keys) {
    const cal = readJSON<{ bpm?: number; firstBeatSec?: number } | null>(k, null);
    if (cal) cals.set(k.slice(CAL_PREFIX.length), cal);
  }
  const folded = tracks.map((t) => {
    const cal = cals.get(t.spotifyUri);
    if (!cal) return t;
    const next = { ...t };
    if (next.bpm == null && typeof cal.bpm === 'number') next.bpm = cal.bpm;
    if (next.firstBeatSec == null && typeof cal.firstBeatSec === 'number') {
      next.firstBeatSec = cal.firstBeatSec;
    }
    return next;
  });
  keys.forEach(removeKey);
  return folded;
}

export function loadStoredTracks(): Track[] | null {
  let tracks = readJSON<Track[] | null>(KEY, null, (data) =>
    Array.isArray(data) ? (data as Track[]) : null,
  );
  if (tracks == null) return null;
  let dirty = false;
  // One-time migration: lists materialized from the old playbook carry
  // `firstBeatSec: 0` on tracks that never authored one (those zeros were
  // later stripped from the playbook because an authored 0 disabled the old
  // player-side "Mark first beat" capture). Clean them once. A 0 the coach
  // types *after* this is deliberate: it stays, and exports faithfully.
  if (!readFlag(ZERO_FIRSTBEAT_CLEANED)) {
    writeFlag(ZERO_FIRSTBEAT_CLEANED, true);
    if (tracks.some((t) => t.firstBeatSec === 0)) {
      tracks = tracks.map(withoutZeroFirstBeat);
      dirty = true;
    }
  }
  // One-time migration: values tapped in the old player UI move into the
  // routine list itself, where they're visible in the editor and exportable.
  const folded = foldLegacyCalibration(tracks);
  if (folded) {
    tracks = folded;
    dirty = true;
  }
  if (dirty) saveStoredTracks(tracks);
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
