import { describe, it, expect } from 'vitest';
import { deriveCountIn, BEATS_PER_COUNT } from './callings';

describe('deriveCountIn', () => {
  it('returns nothing when BPM is unknown (null counts)', () => {
    expect(deriveCountIn(null)).toEqual({ count: null, announcing: false });
  });

  it('does not count in while still far from the switch', () => {
    // 9 beats out: ceil(9/2) = 5 > COUNT_FROM (4) -> no count yet.
    expect(deriveCountIn(9)).toEqual({ count: null, announcing: false });
  });

  it('half-time mapping: each count spans 2 beats', () => {
    // "4" shows ~8 beats out, "3" ~6, "2" ~4, "1" ~2.
    expect(deriveCountIn(8).count).toBe(4);
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

  it('announces for the whole count-in window (whenever a count shows)', () => {
    expect(deriveCountIn(9).announcing).toBe(false); // no count yet
    expect(deriveCountIn(8).announcing).toBe(true); // "4"
    expect(deriveCountIn(4).announcing).toBe(true); // "2"
    expect(deriveCountIn(0.5).announcing).toBe(true); // "1"
  });

  it('honours a custom beatsPerCount (8/8 feel = 1 beat per count)', () => {
    expect(deriveCountIn(4, 1).count).toBe(4);
    expect(deriveCountIn(3, 1).count).toBe(3);
    expect(deriveCountIn(1, 1).count).toBe(1);
    // ceil(5/1) = 5 > COUNT_FROM (4) -> not counting yet.
    expect(deriveCountIn(5, 1).count).toBe(null);
  });

  it('default beatsPerCount is the calm half-time value', () => {
    expect(BEATS_PER_COUNT).toBe(2);
    expect(deriveCountIn(6)).toEqual(deriveCountIn(6, BEATS_PER_COUNT));
  });
});
