import { describe, it, expect } from 'vitest';
import { interpolatePosition } from './position';
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
    fetchedAt: 1_000_000,
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
