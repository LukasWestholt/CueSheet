// Convert coach taps into a routine's timing.
//
// Two kinds of tap series live here: wall-clock taps → BPM (bpmFromTaps), and
// playback-position taps → first beat + per-step measures (tapsToTiming).
// Both feed the editor's TimingFlow.

/**
 * Estimates BPM from a series of tap timestamps (ms) as the rounded inverse of
 * the average gap between consecutive taps. Needs at least two taps.
 */
export function bpmFromTaps(timestamps: number[]): number | null {
  if (timestamps.length < 2) return null;
  const sorted = [...timestamps].sort((a, b) => a - b);
  let sum = 0;
  for (let i = 1; i < sorted.length; i++) sum += sorted[i] - sorted[i - 1];
  const avgMs = sum / (sorted.length - 1);
  if (avgMs <= 0) return null;
  return Math.round(60_000 / avgMs);
}

// Tap-to-time: the coach taps at the start of each step while the track plays,
// then once more at the end of the last step, so N steps need N+1 taps.

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
