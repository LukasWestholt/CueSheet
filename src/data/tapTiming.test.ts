import { describe, it, expect } from 'vitest';
import { tapsToTiming } from './tapTiming';

describe('tapsToTiming', () => {
  it('returns the first tap as firstBeatSec', () => {
    expect(tapsToTiming([2, 6], 120).firstBeatSec).toBe(2);
    expect(tapsToTiming([], 120).firstBeatSec).toBe(0);
  });

  it('converts tap gaps to measures via bpm (8 beats/measure)', () => {
    // 120 bpm -> 1 measure (8 beats) = 4s.
    expect(tapsToTiming([0, 16], 120).measures).toEqual([4]); // 16s = 4 measures
    expect(tapsToTiming([0, 8], 120).measures).toEqual([2]); // 8s = 2 measures
    expect(tapsToTiming([0, 6], 120).measures).toEqual([1.5]); // 6s = 1.5 measures
  });

  it('produces one measure per gap (N taps -> N-1 measures)', () => {
    const taps = [0, 16, 24, 28]; // gaps 16, 8, 4 s @120 -> 4, 2, 1 measures
    expect(tapsToTiming(taps, 120).measures).toEqual([4, 2, 1]);
  });

  it('snaps to the nearest 0.5 and clamps to a minimum of 0.5', () => {
    // 5s @120 = 1.25 measures -> rounds to 1.5? 1.25*2=2.5 -> round 3 -> 1.5.
    expect(tapsToTiming([0, 5], 120).measures).toEqual([1.5]);
    // Tiny gap clamps up to 0.5.
    expect(tapsToTiming([0, 0.1], 120).measures).toEqual([0.5]);
  });

  it('yields no measures without a valid bpm', () => {
    expect(tapsToTiming([0, 8, 16], 0).measures).toEqual([]);
  });
});
