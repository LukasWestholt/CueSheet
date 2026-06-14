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
