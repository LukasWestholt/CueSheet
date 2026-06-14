import { describe, it, expect } from 'vitest';
import { beatsForStep, buildCallings } from './beats';
import type { StepCalling } from './tracks';

describe('beatsForStep', () => {
  it('integer Takte = (x-1) eights + one closing four', () => {
    expect(beatsForStep(1)).toBe(4); //            4
    expect(beatsForStep(2)).toBe(12); // 8       + 4
    expect(beatsForStep(3)).toBe(20); // 16      + 4
    expect(beatsForStep(4)).toBe(28); // 24      + 4
  });

  it('half Takte add a 4/8 bar', () => {
    expect(beatsForStep(1.5)).toBe(8); //  0 + 4 + 4
    expect(beatsForStep(2.5)).toBe(16); // 8 + 4 + 4
    expect(beatsForStep(3.5)).toBe(24); // 16 + 4 + 4
  });

  it('non-positive Takte contribute nothing', () => {
    expect(beatsForStep(0)).toBe(0);
    expect(beatsForStep(-1)).toBe(0);
  });
});

describe('buildCallings', () => {
  const steps: StepCalling[] = [
    { step: 'A', takte: 1 }, // 4 beats
    { step: 'B', cue: 'go', takte: 2 }, // 12 beats
    { step: 'C', takte: 1 }, // 4 beats
  ];

  it('accumulates beats and converts to absolute seconds', () => {
    // bpm 120 => 0.5 s/beat, firstBeat at 1s.
    const result = buildCallings(steps, 1, 120);
    expect(result.map((c) => c.time)).toEqual([
      1, // 1 + 0  beats * 0.5
      3, // 1 + 4  beats * 0.5
      9, // 1 + 16 beats * 0.5
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
