import type { Calling } from '../data/tracks';
import { resolveCallings, humanBeat } from '../data/callings';

/**
 * Builds a conic-gradient that splits the ring's track into `measures` arcs,
 * shading them in alternating tones so the step's length ("N Takte") is visible
 * at a glance. The progress sweep is layered on top of this, so the alternating
 * arcs show through in the still-to-come (unfilled) part of the ring. Returns a
 * solid track for steps shorter than 2 measures (nothing to subdivide).
 */
function measureTrackGradient(measures: number): string {
  const A = 'var(--ring-bg)';
  const B = 'var(--ring-bg-alt)';
  if (!Number.isFinite(measures) || measures <= 1) return `conic-gradient(${A} 0 100%)`;
  const segments = Math.ceil(measures);
  const stops: string[] = [];
  for (let k = 0; k < segments; k++) {
    const start = ((k / measures) * 100).toFixed(2);
    const end = (Math.min((k + 1) / measures, 1) * 100).toFixed(2);
    stops.push(`${k % 2 === 0 ? A : B} ${start}% ${end}%`);
  }
  return `conic-gradient(${stops.join(', ')})`;
}

// The ring is a human 8-count: the coach counts "1 2 3 4 5 6 7 8, 2 2 3 4 …"
// (first beat of each eight = the measure number), then closes each step with
// "4 3 2 →move" — see humanBeat. Without a BPM we can't count beats, so it
// falls back to a plain seconds countdown.

export default function CallingDisplay({
  callings,
  positionSeconds,
  bpm,
}: {
  callings: Calling[];
  positionSeconds: number;
  bpm?: number;
}) {
  const { current, next, secondsToNext, segmentProgress } = resolveCallings(
    callings,
    positionSeconds,
  );

  // Map the position to the way a coach counts it: a running 8-count for the
  // bulk of the step, then a "4 3 2 →move" close. Needs a BPM to know where the
  // beats fall; null → fall back to the seconds ring below.
  const secsPerBeat = bpm ? 60 / bpm : null;
  const beatsToNext =
    secondsToNext !== null && secsPerBeat ? secondsToNext / secsPerBeat : null;
  const beatsElapsed =
    current && secsPerBeat ? Math.max(0, (positionSeconds - current.time) / secsPerBeat) : 0;
  const curStep =
    current && current.measures != null
      ? { measures: current.measures, halfPosition: current.halfPosition }
      : undefined;
  const beat = secsPerBeat ? humanBeat(beatsElapsed, beatsToNext, curStep) : null;
  const announcing = next !== null && (beat?.announcing ?? false);

  // In a run of consecutive short steps, alternate the count-in frame colour
  // (green → yellow) so two quick switches are easy to tell apart.
  const SHORT_COUNTS = 16; // a step ≤ ~2 eight-counts is "short"
  const stepCounts = (i: number): number => {
    const a = callings[i];
    const b = callings[i + 1];
    return a && b && bpm ? ((b.time - a.time) * bpm) / 60 : Infinity;
  };
  const curIdx = current ? callings.indexOf(current) : -1;
  const stepLen = stepCounts(curIdx);
  const isShortCur = stepLen <= SHORT_COUNTS;
  let shortRunBack = 0; // consecutive short steps immediately before curIdx
  if (curIdx >= 0 && isShortCur) {
    for (let i = curIdx; i - 1 >= 0 && stepCounts(i - 1) <= SHORT_COUNTS; i--) {
      shortRunBack++;
    }
  }
  // The first short step in a run (shortRunBack 0) is the first announcement
  // that crowds its predecessor, so it flips to yellow; then they alternate.
  const altFrame = announcing && isShortCur && shortRunBack % 2 === 0;

  // Countdown ring fills as we approach the next calling. Keep two decimals so
  // the conic sweep flows each 100ms tick instead of jumping a whole percent.
  const ringPct = Math.round(segmentProgress * 10000) / 100;

  // Shade the ring's track into the current step's measures ("Takte"), so its
  // length is visible at a glance. The accent progress sweep is layered on top,
  // leaving the alternating arcs showing through the unfilled remainder.
  const ringMeasures =
    current && current.measures != null && Number.isFinite(current.measures)
      ? current.measures
      : 0;
  const ringBackground =
    `conic-gradient(var(--accent) ${ringPct}%, transparent ${ringPct}%), ` +
    measureTrackGradient(ringMeasures);

  return (
    <div
      className={`calling-display ${announcing ? 'announcing' : ''} ${
        altFrame ? 'announcing-alt' : ''
      } ${beat?.downbeat && !announcing ? 'downbeat' : ''}`}
    >
      <div className="now">
        <span className="label">NOW</span>
        <span className="step">{current ? current.step : '—'}</span>
        {current?.cue && <span className="cue">{current.cue}</span>}
      </div>

      <div className={`countdown ${announcing ? 'imminent' : ''}`}>
        <div className="ring" style={{ background: ringBackground }}>
          <div className="ring-inner">
            {beat ? (
              beat.mode === 'announce' ? (
                <span className="ring-num count">→</span>
              ) : beat.count !== null ? (
                <span
                  className={`ring-num ${
                    beat.mode === 'countdown' ? 'count' : beat.downbeat ? 'measure' : 'beat'
                  }`}
                >
                  {beat.count}
                </span>
              ) : (
                <span className="ring-num">✓</span>
              )
            ) : secondsToNext !== null ? (
              <>
                <span className="ring-num">{Math.ceil(secondsToNext)}</span>
                <span className="ring-unit">s</span>
              </>
            ) : (
              <span className="ring-num">✓</span>
            )}
          </div>
        </div>
      </div>

      <div className={`next ${announcing ? 'next-announce' : ''}`}>
        <span className="label">{announcing ? 'CALL NOW' : 'NEXT'}</span>
        <span className="step-next">{next ? next.step : 'End of track'}</span>
        {next?.cue && <span className="cue">{next.cue}</span>}
      </div>
    </div>
  );
}
