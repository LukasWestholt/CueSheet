import type { PlaybackSnapshot } from '../spotify/api';

/**
 * Estimates the live playback position (ms) by extrapolating from the last
 * snapshot: a remote source only reports its position when polled, so between
 * polls we advance a playing track by the elapsed wall-clock time. A paused
 * track stays frozen at its reported position.
 *
 * `now` is injectable for testing. Negative elapsed (clock skew) is clamped to 0.
 */
export function interpolatePosition(snap: PlaybackSnapshot, now: number = Date.now()): number {
  const elapsed = snap.isPlaying ? Math.max(0, now - snap.fetchedAt) : 0;
  return snap.progressMs + elapsed;
}

/** Displayed-position clock state — the last emitted position and when. */
export interface SmoothState {
  posMs: number;
  atMs: number;
}

// Corrections larger than this are a seek / track change — snap, don't slew.
export const SMOOTH_SNAP_MS = 1200;
// Fraction of the drift corrected per tick, and the per-tick cap (ms). The cap
// bounds the display clock's tempo bend to ~±35% of real time, so a beat can
// render slightly long/short but never visibly jump or double-fire.
const SMOOTH_RATE = 0.2;
const SMOOTH_MAX_STEP_MS = 35;

/**
 * Advances the *displayed* position by real elapsed time, easing toward the
 * authoritative interpolated position instead of adopting it outright. Raw
 * interpolation jumps every time a poll lands (network jitter shifts
 * `progressMs`/`fetchedAt`), which made some 8-count beats render long or
 * short. Easing keeps every beat close to its true length; corrections beyond
 * SMOOTH_SNAP_MS (a seek, a track change) snap immediately; within it the
 * clock is monotonic — a backward correction renders as a slower advance.
 */
export function smoothPosition(
  state: SmoothState | null,
  targetMs: number,
  nowMs: number,
): SmoothState {
  if (!state) return { posMs: targetMs, atMs: nowMs };
  const elapsed = Math.max(0, nowMs - state.atMs);
  const predicted = state.posMs + elapsed;
  const drift = targetMs - predicted;
  if (Math.abs(drift) > SMOOTH_SNAP_MS) return { posMs: targetMs, atMs: nowMs };
  const step = Math.max(-SMOOTH_MAX_STEP_MS, Math.min(SMOOTH_MAX_STEP_MS, drift * SMOOTH_RATE));
  // Monotonic: a backward correction renders as a slower advance, never a jump back.
  return { posMs: Math.max(state.posMs, predicted + step), atMs: nowMs };
}
