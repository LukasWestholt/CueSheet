import { describe, it, expect } from 'vitest';
import {
  routineEndSec,
  checkRoutineLength,
  fitLastStepMeasures,
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

describe('fitLastStepMeasures', () => {
  it('sizes the last step to land at the track end, snapped down to 0.5', () => {
    // 120 bpm → 0.5s/beat, 4s per measure. Track 60s, first beat 0, first step
    // 4 measures (16s) → 44s left = 11 measures exactly.
    expect(fitLastStepMeasures(steps([4, 1]), 0, 120, 60_000)).toBe(11);
    // 62s track → 11.5 measures fits (46s = 11.5 × 4s).
    expect(fitLastStepMeasures(steps([4, 1]), 0, 120, 62_000)).toBe(11.5);
    // 61s → 11.25 measures available, snap DOWN to 11 (never overshoot).
    expect(fitLastStepMeasures(steps([4, 1]), 0, 120, 61_000)).toBe(11);
  });

  it('accounts for the first beat and clamps to a minimum of 0.5', () => {
    expect(fitLastStepMeasures(steps([4, 1]), 2, 120, 60_000)).toBe(10.5);
    // Other steps already overrun the track → smallest legal step.
    expect(fitLastStepMeasures(steps([20, 4]), 0, 120, 60_000)).toBe(0.5);
  });

  it('returns null when not computable or already fitting', () => {
    expect(fitLastStepMeasures(steps([4, 1]), 0, null, 60_000)).toBeNull();
    expect(fitLastStepMeasures(steps([4, 1]), 0, 120, null)).toBeNull();
    expect(fitLastStepMeasures([], 0, 120, 60_000)).toBeNull();
    // Already exactly the fitted value → no-op.
    expect(fitLastStepMeasures(steps([4, 11]), 0, 120, 60_000)).toBeNull();
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
