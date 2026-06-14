import { describe, it, expect } from 'vitest';
import { resolveCallings } from './callings';
import type { Calling } from './tracks';

const callings: Calling[] = [
  { time: 0, step: 'Basic Bounce' },
  { time: 10, step: 'Jumping Jacks', cue: '8 counts' },
  { time: 30, step: 'High Knees' },
];

describe('resolveCallings', () => {
  it('before the first calling time there is no current, next is the first', () => {
    const r = resolveCallings([{ time: 5, step: 'Late' }], 0);
    expect(r.current).toBeNull();
    expect(r.next?.step).toBe('Late');
    expect(r.secondsToNext).toBe(5);
    expect(r.segmentProgress).toBe(0);
  });

  it('picks the last calling whose time has passed', () => {
    const r = resolveCallings(callings, 12);
    expect(r.current?.step).toBe('Jumping Jacks');
    expect(r.next?.step).toBe('High Knees');
  });

  it('exact boundary counts as active (inclusive)', () => {
    const r = resolveCallings(callings, 10);
    expect(r.current?.step).toBe('Jumping Jacks');
    expect(r.secondsToNext).toBe(20);
  });

  it('counts down seconds to the next calling', () => {
    const r = resolveCallings(callings, 25);
    expect(r.secondsToNext).toBe(5);
  });

  it('reports segment progress between current and next', () => {
    const r = resolveCallings(callings, 20); // halfway between 10 and 30
    expect(r.segmentProgress).toBeCloseTo(0.5, 5);
  });

  it('after the last calling: current is last, no next, progress is 1', () => {
    const r = resolveCallings(callings, 120);
    expect(r.current?.step).toBe('High Knees');
    expect(r.next).toBeNull();
    expect(r.secondsToNext).toBeNull();
    expect(r.segmentProgress).toBe(1);
  });

  it('clamps segment progress into [0, 1]', () => {
    // Position slightly before next but within a segment still clamps fine.
    const r = resolveCallings(callings, 9.999);
    expect(r.segmentProgress).toBeGreaterThanOrEqual(0);
    expect(r.segmentProgress).toBeLessThanOrEqual(1);
  });
});
