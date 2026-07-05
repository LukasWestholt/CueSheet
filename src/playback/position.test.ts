import { describe, it, expect } from 'vitest';
import { interpolatePosition, smoothPosition, SMOOTH_SNAP_MS } from './position';
import type { PlaybackSnapshot } from '../spotify/api';

function snap(over: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot {
  return {
    isPlaying: true,
    progressMs: 5_000,
    durationMs: 200_000,
    trackUri: 'spotify:track:t',
    deviceId: 'd',
    deviceName: 'Tablet',
    deviceType: null,
    volumePercent: null,    fetchedAt: 1_000_000,
    ...over,
  };
}

describe('interpolatePosition', () => {
  it('advances a playing track by the elapsed wall-clock time', () => {
    const s = snap({ progressMs: 5_000, fetchedAt: 1_000_000 });
    expect(interpolatePosition(s, 1_000_000)).toBe(5_000); // no time passed
    expect(interpolatePosition(s, 1_002_500)).toBe(7_500); // +2.5s
  });

  it('keeps a paused track frozen at its reported position', () => {
    const s = snap({ isPlaying: false, progressMs: 8_000, fetchedAt: 1_000_000 });
    expect(interpolatePosition(s, 1_050_000)).toBe(8_000);
  });

  it('clamps negative elapsed (clock skew) to zero', () => {
    const s = snap({ progressMs: 5_000, fetchedAt: 1_000_000 });
    expect(interpolatePosition(s, 999_000)).toBe(5_000);
  });

  it('defaults `now` to the current time', () => {
    const s = snap({ progressMs: 1_234, fetchedAt: Date.now() });
    // Within a few ms of the reported position right after fetching.
    const pos = interpolatePosition(s);
    expect(pos).toBeGreaterThanOrEqual(1_234);
    expect(pos).toBeLessThan(1_234 + 1_000);
  });
});

describe('smoothPosition', () => {
  it('adopts the target outright when starting fresh', () => {
    const s = smoothPosition(null, 12_345, 1_000_000);
    expect(s).toEqual({ posMs: 12_345, atMs: 1_000_000 });
  });

  it('advances by elapsed time when the target agrees', () => {
    const s0 = smoothPosition(null, 10_000, 1_000_000);
    const s1 = smoothPosition(s0, 10_100, 1_000_100);
    expect(s1.posMs).toBe(10_100);
  });

  it('eases a poll correction in instead of jumping', () => {
    const s0 = smoothPosition(null, 10_000, 1_000_000);
    // Poll landed: target says we're 400ms further ahead than predicted.
    const s1 = smoothPosition(s0, 10_500, 1_000_100);
    // One tick moves at most the per-tick cap (35ms) toward it, not all 400.
    expect(s1.posMs).toBeGreaterThan(10_100);
    expect(s1.posMs).toBeLessThanOrEqual(10_135);
  });

  it('converges onto a stable offset over successive ticks', () => {
    let s = smoothPosition(null, 10_000, 1_000_000);
    // The authoritative clock is 300ms ahead; feed consistent targets each 100ms.
    for (let i = 1; i <= 40; i++) {
      s = smoothPosition(s, 10_300 + i * 100, 1_000_000 + i * 100);
    }
    // After 4s the display has closed the 300ms gap (within a few ms).
    expect(Math.abs(s.posMs - (10_300 + 40 * 100))).toBeLessThan(10);
  });

  it('never moves backwards on a negative correction', () => {
    const s0 = smoothPosition(null, 10_000, 1_000_000);
    // Target says we're 300ms *behind* the prediction.
    const s1 = smoothPosition(s0, 9_800, 1_000_100);
    expect(s1.posMs).toBeGreaterThanOrEqual(s0.posMs);
    // The slowdown shows up as a smaller-than-elapsed advance.
    expect(s1.posMs).toBeLessThan(10_100);
  });

  it('snaps on a big jump (seek / track change)', () => {
    const s0 = smoothPosition(null, 10_000, 1_000_000);
    const s1 = smoothPosition(s0, 10_000 + SMOOTH_SNAP_MS + 200, 1_000_100);
    expect(s1.posMs).toBe(10_000 + SMOOTH_SNAP_MS + 200);
    const s2 = smoothPosition(s1, 2_000, 1_000_200);
    expect(s2.posMs).toBe(2_000);
  });
});
