// Advisory BPM bands for a jumping-fitness class, matching how a session is
// built: warm-up songs at 95–115 BPM, main songs at 115–130 (with 125–130
// suiting the second main part). Below ~95 is hard to use even for a warm-up;
// above 130 gets hard to control. These are guidance, not hard limits — a
// coach can deliberately use a slow or fast track.

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
  if (bpm < 95) {
    return { level: 'too-slow', label: 'Very slow — below the warm-up range (~95–115 BPM).' };
  }
  if (bpm < 115) {
    return { level: 'slow', label: 'Warm-up range (95–115 BPM) — good opener, slow for a main song.' };
  }
  if (bpm < 125) {
    return { level: 'ideal', label: 'Main-song range (115–130 BPM).' };
  }
  if (bpm <= 130) {
    return { level: 'ideal', label: 'Main-song range (115–130 BPM) — 125–130 suits main part 2.' };
  }
  if (bpm <= 140) {
    return { level: 'fast', label: 'Fast — above the main range (115–130), tiring to sustain.' };
  }
  return { level: 'too-fast', label: 'Very fast — likely too fast for controlled jumping.' };
}
