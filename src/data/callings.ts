import type { Calling } from './tracks';

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
 * How many musical beats one displayed count-in number spans. At 2, the
 * count-in ticks every 2 beats ("4/4" feel) instead of every beat ("8/8"),
 * so "3 … 2 … 1 … <next>" plays back roughly half as fast.
 */
export const BEATS_PER_COUNT = 2;

/** Highest count-in number shown (the "4" in "4, 3, 2, 1"). */
export const COUNT_FROM = 4;

export interface CountIn {
  /** The number to show (1..COUNT_FROM), or null when not yet counting in. */
  count: number | null;
  /**
   * Whether the next move should be emphasised ("CALL NOW"). True for the whole
   * count-in window, so the coach sees the upcoming step enlarged from "4" on.
   */
  announcing: boolean;
}

/**
 * Derives the beat-synced count-in from the beats remaining until the next
 * step. Each displayed number spans `beatsPerCount` beats, so e.g. with the
 * default of 2 the count shows "3" ~6 beats out, "2" ~4, "1" ~2.
 *
 * `countsToNext` is `secondsToNext * bpm / 60`; pass null when BPM is unknown
 * (the caller then falls back to the seconds ring).
 */
export function deriveCountIn(
  countsToNext: number | null,
  beatsPerCount: number = BEATS_PER_COUNT,
): CountIn {
  if (countsToNext === null) return { count: null, announcing: false };

  const displayCount = Math.ceil(countsToNext / beatsPerCount);
  const count = displayCount <= COUNT_FROM ? Math.max(1, displayCount) : null;
  // Emphasise the next move for the whole count-in window (last COUNT_FROM counts).
  const announcing = count !== null;

  return { count, announcing };
}
