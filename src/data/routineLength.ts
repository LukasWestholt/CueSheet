import { beatsForStep } from './beats';
import type { StepCalling } from './tracks';

/**
 * Seconds at which the routine finishes: the first beat plus every step's beats
 * converted with the BPM. This is the *end* of the last step, not its start.
 */
export function routineEndSec(
  steps: StepCalling[],
  firstBeatSec: number,
  bpm: number,
): number {
  const totalBeats = steps.reduce((sum, s) => sum + beatsForStep(s.measures), 0);
  return firstBeatSec + (totalBeats * 60) / bpm;
}

export type LengthStatus = 'ok' | 'overshoot' | 'undershoot' | 'unknown';

export interface LengthCheck {
  status: LengthStatus;
  /** routineEnd − trackDuration, in seconds (positive = runs past the end). */
  diffSec: number;
  routineEndSec: number;
  trackDurationSec: number;
}

// How far the routine may diverge from the track length before we warn.
// Overshoot is flagged eagerly — any calling past the end is one you'll never
// reach. Undershoot tolerates a short outro/fade ending before the calls run out.
export const OVERSHOOT_TOL_SEC = 1;
export const UNDERSHOOT_TOL_SEC = 12;

/**
 * Compares a routine's derived length to the track duration. Returns `unknown`
 * when BPM or duration is missing (we can't derive seconds without a BPM).
 */
export function checkRoutineLength(
  steps: StepCalling[],
  firstBeatSec: number,
  bpm: number | null | undefined,
  durationMs: number | null | undefined,
): LengthCheck {
  if (!bpm || bpm <= 0 || !durationMs || durationMs <= 0) {
    return { status: 'unknown', diffSec: 0, routineEndSec: 0, trackDurationSec: 0 };
  }
  const end = routineEndSec(steps, firstBeatSec, bpm);
  const dur = durationMs / 1000;
  const diff = end - dur;
  let status: LengthStatus = 'ok';
  if (diff > OVERSHOOT_TOL_SEC) status = 'overshoot';
  else if (diff < -UNDERSHOOT_TOL_SEC) status = 'undershoot';
  return { status, diffSec: diff, routineEndSec: end, trackDurationSec: dur };
}

/** A short human warning for a check, or null when it's ok/unknown. */
export function lengthWarning(check: LengthCheck): string | null {
  if (check.status === 'overshoot') {
    return `Routine runs ~${Math.round(check.diffSec)}s past the track end — later steps won't be reached. Check for a mistyped "measures".`;
  }
  if (check.status === 'undershoot') {
    return `Routine ends ~${Math.round(-check.diffSec)}s before the track does — the song keeps playing with no calls.`;
  }
  return null;
}
