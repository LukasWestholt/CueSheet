import type { Calling, StepCalling } from './tracks';

export const BEATS_PER_FULL_BAR = 8; // an "8/8" Takt
export const BEATS_PER_SHORT_BAR = 4; // the closing "4/4" (and a half-Takt "4/8")

/**
 * Number of beats a step occupies.
 *
 * Model: a step of `takte` 8-counts is (takte − 1) full bars of 8/8 plus one
 * closing bar of 4/4. A half Takt (x.5) contributes an extra 4/8 bar.
 *
 *   takte 4   -> 3×8 + 4            = 28 beats
 *   takte 2   -> 1×8 + 4            = 12 beats
 *   takte 2.5 -> 1×8 + 4 (½) + 4    = 16 beats
 *   takte 1   ->        4           =  4 beats
 */
export function beatsForStep(takte: number): number {
  if (takte <= 0) return 0;
  const fullEights = Math.max(0, Math.floor(takte) - 1);
  const frac = takte - Math.floor(takte);
  const hasHalf = Math.abs(frac - 0.5) < 1e-9;
  return fullEights * BEATS_PER_FULL_BAR + (hasHalf ? BEATS_PER_SHORT_BAR : 0) + BEATS_PER_SHORT_BAR;
}

/**
 * Resolves authored steps to absolute start times (seconds), accumulating beats
 * and converting with the track's BPM and first-beat offset.
 *
 *   start(step_i) = firstBeatSec + (beats before step_i) × 60 / bpm
 */
export function buildCallings(
  steps: StepCalling[],
  firstBeatSec: number,
  bpm: number,
): Calling[] {
  const secondsPerBeat = 60 / bpm;
  let beatCursor = 0;
  return steps.map((s) => {
    const time = firstBeatSec + beatCursor * secondsPerBeat;
    beatCursor += beatsForStep(s.takte);
    return { time, step: s.step, cue: s.cue };
  });
}
