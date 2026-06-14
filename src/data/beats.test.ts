import { describe, it, expect } from 'vitest';
import { beatsForStep, buildCallings } from './beats';
import type { StepCalling } from './tracks';

describe('beatsForStep', () => {
  it('integer measures = measures × 8 beats', () => {
    expect(beatsForStep(1)).toBe(8);
    expect(beatsForStep(2)).toBe(16);
    expect(beatsForStep(3)).toBe(24);
    expect(beatsForStep(4)).toBe(32);
  });

  it('half measures are half an 8-count (×8)', () => {
    expect(beatsForStep(1.5)).toBe(12);
    expect(beatsForStep(2.5)).toBe(20);
    expect(beatsForStep(3.5)).toBe(28);
  });

  it('non-positive measures contribute nothing', () => {
    expect(beatsForStep(0)).toBe(0);
    expect(beatsForStep(-1)).toBe(0);
  });
});

describe('buildCallings', () => {
  const steps: StepCalling[] = [
    { step: 'A', measures: 1 }, // 8 beats
    { step: 'B', cue: 'go', measures: 2 }, // 16 beats
    { step: 'C', measures: 1 }, // 8 beats
  ];

  it('accumulates beats and converts to absolute seconds', () => {
    // bpm 120 => 0.5 s/beat, firstBeat at 1s.
    const result = buildCallings(steps, 1, 120);
    expect(result.map((c) => c.time)).toEqual([
      1, // 1 + 0  beats * 0.5
      5, // 1 + 8  beats * 0.5
      13, // 1 + 24 beats * 0.5
    ]);
  });

  it('carries step + cue through', () => {
    const result = buildCallings(steps, 0, 120);
    expect(result[1]).toMatchObject({ step: 'B', cue: 'go' });
    expect(result[0].cue).toBeUndefined();
  });

  it('scales with BPM', () => {
    const slow = buildCallings(steps, 0, 60); // 1 s/beat
    const fast = buildCallings(steps, 0, 120); // 0.5 s/beat
    expect(slow[2].time).toBe(fast[2].time * 2);
  });
});
