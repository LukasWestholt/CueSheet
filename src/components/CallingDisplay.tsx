import type { Calling } from '../data/tracks';
import { resolveCallings, deriveCountIn } from '../data/callings';

// The "4/4" count-in: in the final counts before a switch, the coach calls
// "3, 2, 1, <next move>". We surface that as a beat-synced visual cue. Each
// number spans BEATS_PER_COUNT beats (see deriveCountIn), so the spoken count
// is calm enough to call out rather than flying by once per beat.

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

  // Convert the remaining time into musical counts (beats), then into a
  // half-time count-in where each displayed number spans 2 beats.
  const countsToNext =
    secondsToNext !== null && bpm ? (secondsToNext * bpm) / 60 : null;
  const { count: countIn, announcing: countAnnouncing } =
    deriveCountIn(countsToNext);
  const announcing = next !== null && countAnnouncing;

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

  // Dev-only debug: why the yellow alt frame is (not) on, and how close it was
  // — e.g. "+1.5c over short" means the step missed the SHORT_COUNTS cut-off by
  // 1.5 counts, so raising the threshold would have turned it yellow.
  const stepLenLabel = Number.isFinite(stepLen) ? stepLen.toFixed(1) : '∞';
  const altReason = !announcing
    ? 'idle'
    : altFrame
      ? 'YELLOW'
      : !isShortCur
        ? `+${(stepLen - SHORT_COUNTS).toFixed(1)}c over short (≤${SHORT_COUNTS})`
        : `short, run ${shortRunBack} (odd → green)`;

  // Countdown ring fills as we approach the next calling.
  const ringPct = Math.round(segmentProgress * 100);

  return (
    <>
    <div
      className={`calling-display ${announcing ? 'announcing' : ''} ${
        altFrame ? 'announcing-alt' : ''
      }`}
    >
      <div className="now">
        <span className="label">NOW</span>
        <span className="step">{current ? current.step : '—'}</span>
        {current?.cue && <span className="cue">{current.cue}</span>}
      </div>

      <div className={`countdown ${announcing ? 'imminent' : ''}`}>
        <div
          className="ring"
          style={{
            background: `conic-gradient(var(--accent) ${ringPct}%, var(--ring-bg) ${ringPct}%)`,
          }}
        >
          <div className="ring-inner">
            {countIn !== null ? (
              <span className="ring-num count">{countIn}</span>
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
      {import.meta.env.DEV && (
        <div className="calling-debug">
          frame {altFrame ? 'YELLOW' : 'green'} · step#{curIdx} {stepLenLabel}c ·{' '}
          {altReason}
        </div>
      )}
    </>
  );
}
