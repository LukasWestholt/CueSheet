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
