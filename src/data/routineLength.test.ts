import { describe, it, expect } from 'vitest';
import {
  routineEndSec,
  checkRoutineLength,
  lengthWarning,
  OVERSHOOT_TOL_SEC,
  UNDERSHOOT_TOL_SEC,
} from './routineLength';
import type { StepCalling } from './tracks';

const steps = (measures: number[]): StepCalling[] =>
  measures.map((m, i) => ({ step: `S${i}`, measures: m }));

describe('routineEndSec', () => {
  it('is firstBeat + total beats / bps', () => {
    // 2 steps of 4 measures = 8 measures = 64 beats. At 128 bpm that's 30s.
    expect(routineEndSec(steps([4, 4]), 1, 128)).toBeCloseTo(1 + (64 * 60) / 128, 6);
  });

  it('counts half measures (2.5 -> 20 beats)', () => {
    expect(routineEndSec(steps([2.5]), 0, 120)).toBeCloseTo((20 * 60) / 120, 6);
  });
});

describe('checkRoutineLength', () => {
  it('is unknown without a BPM or duration', () => {
    expect(checkRoutineLength(steps([4]), 0, null, 180_000).status).toBe('unknown');
    expect(checkRoutineLength(steps([4]), 0, 128, null).status).toBe('unknown');
    expect(checkRoutineLength(steps([4]), 0, 0, 180_000).status).toBe('unknown');
  });

  it('is ok when the routine end matches the duration', () => {
    const end = routineEndSec(steps([4, 4]), 1, 128); // ~31s
    const c = checkRoutineLength(steps([4, 4]), 1, 128, end * 1000);
    expect(c.status).toBe('ok');
    expect(c.diffSec).toBeCloseTo(0, 6);
  });

  it('flags an overshoot past the small tolerance', () => {
    const end = routineEndSec(steps([4, 4]), 1, 128);
    // Track is 5s shorter than the routine -> overshoots.
    const c = checkRoutineLength(steps([4, 4]), 1, 128, (end - 5) * 1000);
    expect(c.status).toBe('overshoot');
    expect(c.diffSec).toBeCloseTo(5, 4);
    expect(lengthWarning(c)).toMatch(/past the track end/);
  });

  it('does not flag an overshoot within tolerance', () => {
    const end = routineEndSec(steps([4]), 0, 128);
    const c = checkRoutineLength(steps([4]), 0, 128, (end - OVERSHOOT_TOL_SEC / 2) * 1000);
    expect(c.status).toBe('ok');
  });

  it('flags an undershoot only past its (larger) tolerance', () => {
    const end = routineEndSec(steps([4]), 0, 128);
    const within = checkRoutineLength(steps([4]), 0, 128, (end + UNDERSHOOT_TOL_SEC - 1) * 1000);
    expect(within.status).toBe('ok');
    const beyond = checkRoutineLength(steps([4]), 0, 128, (end + UNDERSHOOT_TOL_SEC + 5) * 1000);
    expect(beyond.status).toBe('undershoot');
    expect(lengthWarning(beyond)).toMatch(/before the track/);
  });

  it('lengthWarning is null for ok/unknown', () => {
    expect(lengthWarning(checkRoutineLength(steps([4]), 0, null, null))).toBeNull();
  });
});
