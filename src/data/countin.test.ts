import { describe, it, expect } from 'vitest';
import { deriveCountIn, BEATS_PER_COUNT } from './callings';

describe('deriveCountIn', () => {
  it('returns nothing when BPM is unknown (null counts)', () => {
    expect(deriveCountIn(null)).toEqual({ count: null, announcing: false });
  });

  it('does not count in while still far from the switch', () => {
    // 7 beats out: ceil(7/2) = 4 > COUNT_FROM (3) -> no count yet.
    expect(deriveCountIn(7)).toEqual({ count: null, announcing: false });
  });

  it('half-time mapping: each count spans 2 beats', () => {
    // "3" shows ~6 beats out, "2" ~4 beats, "1" ~2 beats.
    expect(deriveCountIn(6).count).toBe(3);
    expect(deriveCountIn(5).count).toBe(3);
    expect(deriveCountIn(4).count).toBe(2);
    expect(deriveCountIn(3).count).toBe(2);
    expect(deriveCountIn(2).count).toBe(1);
    expect(deriveCountIn(1).count).toBe(1);
  });

  it('clamps to a minimum of 1 right before the switch', () => {
    expect(deriveCountIn(0).count).toBe(1);
    expect(deriveCountIn(0.2).count).toBe(1);
  });

  it('announces only during the final count (~2 beats out)', () => {
    expect(deriveCountIn(6).announcing).toBe(false);
    expect(deriveCountIn(4).announcing).toBe(false);
    expect(deriveCountIn(2).announcing).toBe(true);
    expect(deriveCountIn(0.5).announcing).toBe(true);
  });

  it('honours a custom beatsPerCount (8/8 feel = 1 beat per count)', () => {
    expect(deriveCountIn(3, 1).count).toBe(3);
    expect(deriveCountIn(2, 1).count).toBe(2);
    expect(deriveCountIn(1, 1).count).toBe(1);
    // ceil(4/1) = 4 > COUNT_FROM -> not counting yet.
    expect(deriveCountIn(4, 1).count).toBe(null);
  });

  it('default beatsPerCount is the calm half-time value', () => {
    expect(BEATS_PER_COUNT).toBe(2);
    expect(deriveCountIn(6)).toEqual(deriveCountIn(6, BEATS_PER_COUNT));
  });
});
