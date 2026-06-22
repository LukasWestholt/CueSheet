import type { Calling } from './tracks';
import { BEATS_PER_MEASURE } from './beats';

export interface ActiveCallings {
  current: Calling | null;
  next: Calling | null;
  /** Seconds until the next calling becomes active (>= 0), or null if none. */
  secondsToNext: number | null;
  /** 0..1 progress through the current calling toward the next. */
  segmentProgress: number;
}

/** Resolves which calling is active at `positionSeconds`, given timed callings. */
export function resolveCallings(
  callings: Calling[],
  positionSeconds: number,
): ActiveCallings {
  let currentIndex = -1;
  for (let i = 0; i < callings.length; i++) {
    if (callings[i].time <= positionSeconds) currentIndex = i;
    else break;
  }

  const current = currentIndex >= 0 ? callings[currentIndex] : null;
  const next = currentIndex + 1 < callings.length ? callings[currentIndex + 1] : null;

  const secondsToNext = next ? Math.max(0, next.time - positionSeconds) : null;

  let segmentProgress = 0;
  if (current && next) {
    const span = next.time - current.time;
    segmentProgress = span > 0 ? (positionSeconds - current.time) / span : 0;
  } else if (current && !next) {
    segmentProgress = 1;
  }

  return {
    current,
    next,
    secondsToNext,
    segmentProgress: Math.min(1, Math.max(0, segmentProgress)),
  };
}

/**
 * How many musical beats one closing count-in number spans. At 2, the close
 * ticks every 2 beats ("4/4" feel) instead of every beat, so "4 … 3 … 2 …"
 * plays back calmly enough to call out.
 */
export const BEATS_PER_COUNT = 2;

/** Highest closing count shown (the "4" in "4, 3, 2, →move"). */
export const COUNT_FROM = 4;

export type BeatMode =
  /** Running 8-count: "1 2 3 4 5 6 7 8, 2 2 3 4 …" (first beat = measure no.). */
  | 'count'
  /** Closing count-in toward the switch: 4, 3, 2. */
  | 'countdown'
  /** Final beat of the step: announce the move (we never say "1"). */
  | 'announce'
  /** No next step — end of track. */
  | 'end';

export interface BeatDisplay {
  /** Number to show: the running 8-count, or the closing 4/3/2. null otherwise. */
  count: number | null;
  mode: BeatMode;
  /** Emphasise the upcoming move — true through the whole closing window. */
  announcing: boolean;
}

/**
 * Maps a position within a step to the way a coach counts it aloud:
 *
 *   1 2 3 4 5 6 7 8,  2 2 3 4 5 6 7 8,  3 2 3 4 5 6 7 8,  4 3 2 →move
 *
 * — the first beat of every eight is the measure number, then it closes with
 * "4 3 2" (each spanning `BEATS_PER_COUNT` beats) and announces the next move
 * on the final beat (we never say "1": the move name is the best-timed call
 * there). A half measure falls out naturally as a short "N 2 3 4" group right
 * before the close.
 *
 * `beatsElapsed` — beats since the current step began (fractional ok).
 * `beatsToNext`  — beats until the next step, or null when there is none.
 * `step`         — the current step's length, so a half measure can be placed
 *                  (front vs. just-before-the-close). Omit to use plain 8-count
 *                  alignment (natural placement).
 */
export function humanBeat(
  beatsElapsed: number,
  beatsToNext: number | null,
  step?: { measures: number; halfPosition?: number },
): BeatDisplay {
  if (beatsToNext === null) return { count: null, mode: 'end', announcing: false };

  // Closing window: the last COUNT_FROM × BEATS_PER_COUNT beats before the switch.
  const closing = Math.ceil(beatsToNext / BEATS_PER_COUNT);
  if (closing <= COUNT_FROM) {
    // "4 3 2" are spoken; the would-be "1" beat announces the move instead.
    if (closing <= 1) return { count: null, mode: 'announce', announcing: true };
    return { count: closing, mode: 'countdown', announcing: true };
  }

  // Running 8-count: the downbeat of each measure shows the measure ordinal.
  const beat = Math.max(0, Math.floor(beatsElapsed));
  const count =
    step && Number.isFinite(step.measures)
      ? runningCount(beat, step.measures, step.halfPosition)
      : plainCount(beat);
  return { count, mode: 'count', announcing: false };
}

/** Plain 8-count alignment: 1..8 with the measure number on each downbeat. */
function plainCount(beat: number): number {
  const pos = beat % BEATS_PER_MEASURE;
  return pos === 0 ? Math.floor(beat / BEATS_PER_MEASURE) + 1 : pos + 1;
}

interface BeatGroup {
  /** Beats in this counted group (8 for a full measure, 4 for the orphan half). */
  len: number;
  /** Number called on the group's downbeat. */
  label: number;
}

/**
 * The counted groups of a step *before* its closing count-in (the last 8 beats,
 * handled separately). Full measures are labelled 1, 2, … in playing order; a
 * half measure (when `measures` ends in .5) is inserted after `halfPosition`
 * full measures and labelled `halfPosition + 1`:
 *
 *   4.5, halfPosition 0 → [½:1] [1:1] [1:2] [1:3]   →  1 2 3 4, 1…8, 2…8, 3…8
 *   4.5, halfPosition 3 → [1:1] [1:2] [1:3] [½:4]   →  1…8, 2…8, 3…8, 4 2 3 4
 */
export function preCloseGroups(measures: number, halfPosition?: number): BeatGroup[] {
  const F = Math.floor(measures);
  const hasHalf = Math.round(measures * 2) % 2 === 1;
  const fullCount = Math.max(0, F - 1); // the last full measure is the close
  const groups: BeatGroup[] = [];
  const addFull = (from: number, to: number) => {
    for (let k = from; k <= to; k++) groups.push({ len: BEATS_PER_MEASURE, label: k });
  };
  if (!hasHalf) {
    addFull(1, fullCount);
    return groups;
  }
  // 0 = front, default = just before the close.
  const p = Math.min(Math.max(Math.round(halfPosition ?? fullCount), 0), fullCount);
  addFull(1, p);
  groups.push({ len: BEATS_PER_MEASURE / 2, label: p + 1 });
  addFull(p + 1, fullCount);
  return groups;
}

function runningCount(beat: number, measures: number, halfPosition?: number): number {
  let acc = 0;
  for (const g of preCloseGroups(measures, halfPosition)) {
    if (beat < acc + g.len) {
      const pos = beat - acc;
      return pos === 0 ? g.label : pos + 1;
    }
    acc += g.len;
  }
  return plainCount(beat); // safety: beyond the pre-close region
}
