import type { Calling, StepCalling } from './tracks';

export const BEATS_PER_MEASURE = 8; // one measure ("Takt") = a full 8-count (8/8)

/**
 * Number of beats a step occupies: one measure = a full 8-count, so a step of
 * `measures` 8-counts is `measures × 8` beats. Half measures fall out naturally
 * (2.5 → 20 beats = two 8/8 + one 4/8). Step lengths therefore never shrink, so
 * the derived timeline does not drift across a track.
 *
 *   measures 4   -> 32 beats
 *   measures 2   -> 16 beats
 *   measures 2.5 -> 20 beats
 *   measures 1   ->  8 beats
 */
export function beatsForStep(measures: number): number {
  return measures > 0 ? measures * BEATS_PER_MEASURE : 0;
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
    beatCursor += beatsForStep(s.measures);
    return { time, step: s.step, cue: s.cue };
  });
}
