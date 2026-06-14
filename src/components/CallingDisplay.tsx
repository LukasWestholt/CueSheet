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

  // Countdown ring fills as we approach the next calling.
  const ringPct = Math.round(segmentProgress * 100);

  return (
    <div className={`calling-display ${announcing ? 'announcing' : ''}`}>
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
  );
}
