// Advisory BPM bands for jumping fitness. Sources converge on ~128–140 BPM as
// the sweet spot for sustained trampoline/jumping cardio (130–135 most common);
// slower suits warm-ups, much faster gets hard to control. These are guidance,
// not hard limits — a coach can deliberately use a slow or fast track.

export type BpmLevel = 'too-slow' | 'slow' | 'ideal' | 'fast' | 'too-fast';

export interface BpmAdvice {
  level: BpmLevel;
  label: string;
}

/** CSS class for color-coding a BPM value by its jumping-fitness band. */
export function bpmLevelClass(level: BpmLevel): 'bpm-ok' | 'bpm-warn' | 'bpm-bad' {
  if (level === 'ideal') return 'bpm-ok';
  if (level === 'slow' || level === 'fast') return 'bpm-warn';
  return 'bpm-bad';
}

export function bpmAdvice(bpm: number): BpmAdvice {
  if (!(bpm > 0)) return { level: 'too-slow', label: 'Set a BPM to check the jumping range.' };
  if (bpm < 115) {
    return { level: 'too-slow', label: 'Slow — warm-up / cool-down pace; hard to sustain jumping below ~120.' };
  }
  if (bpm < 128) {
    return { level: 'slow', label: 'On the slower side — good for warm-ups or controlled moves.' };
  }
  if (bpm <= 140) {
    return { level: 'ideal', label: 'Ideal jumping-fitness range (~128–140 BPM).' };
  }
  if (bpm <= 155) {
    return { level: 'fast', label: 'Fast — high-intensity / sprint pace, tiring to sustain.' };
  }
  return { level: 'too-fast', label: 'Very fast — likely too fast for controlled jumping.' };
}
