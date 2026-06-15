import type { Track } from './tracks';

/** Resolve an ordered list of track ids to tracks, dropping ids not found. */
export function resolveSetlist(ids: string[], tracks: Track[]): Track[] {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter((t): t is Track => t != null);
}

export interface SessionEstimate {
  /** Whole-session length: every track plus a gap between each pair. */
  totalMs: number;
  /** Time left from `currentPosMs` in the current track to the end of the session. */
  remainingMs: number;
}

/**
 * Estimated session length and remaining time. `durationsMs[i]` is each track's
 * duration (0 when unknown). A `gapSeconds` gap sits between consecutive tracks.
 * `currentIndex`/`currentPosMs` mark where playback is now.
 */
export function sessionEstimate(
  durationsMs: number[],
  currentIndex: number,
  currentPosMs: number,
  gapSeconds: number,
): SessionEstimate {
  const n = durationsMs.length;
  if (n === 0) return { totalMs: 0, remainingMs: 0 };

  const gapMs = Math.max(0, gapSeconds) * 1000;
  const sum = (from: number) => {
    let s = 0;
    for (let k = from; k < n; k++) s += Math.max(0, durationsMs[k]);
    return s;
  };
  const totalMs = sum(0) + gapMs * (n - 1);

  const i = Math.min(Math.max(0, currentIndex), n - 1);
  const curRemaining = Math.max(0, Math.max(0, durationsMs[i]) - Math.max(0, currentPosMs));
  const gapsAhead = n - 1 - i; // one gap precedes each upcoming track
  const remainingMs = curRemaining + sum(i + 1) + gapMs * gapsAhead;

  return { totalMs, remainingMs };
}
