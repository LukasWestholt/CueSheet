// Convert a sequence of taps (made while the track plays) into a routine's
// timing. The coach taps at the start of each step, then once more at the end
// of the last step, so N steps need N+1 taps.

export interface TapTiming {
  /** Start of the routine = first tap (seconds). */
  firstBeatSec: number;
  /** measures[i] = length of step i, derived from tap i+1 − tap i. */
  measures: number[];
}

const BEATS_PER_MEASURE = 8;

/**
 * Tap times are in seconds (playback position at each tap). The gap between
 * consecutive taps is a step's duration; converted to measures via BPM
 * (`seconds × bpm / (8 × 60)`) and snapped to the nearest 0.5 (min 0.5).
 * Human reaction lag mostly cancels because we use the *differences* between
 * taps, not their absolute values.
 */
export function tapsToTiming(taps: number[], bpm: number): TapTiming {
  const firstBeatSec = taps.length > 0 ? Math.max(0, taps[0]) : 0;
  const measures: number[] = [];
  if (bpm > 0) {
    for (let i = 1; i < taps.length; i++) {
      const seconds = Math.max(0, taps[i] - taps[i - 1]);
      const m = (seconds * bpm) / (BEATS_PER_MEASURE * 60);
      measures.push(Math.max(0.5, Math.round(m * 2) / 2));
    }
  }
  return { firstBeatSec, measures };
}
