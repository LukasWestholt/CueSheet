import type { Calling } from '../data/tracks';
import { resolveCallings } from '../data/callings';

export default function CallingDisplay({
  callings,
  positionSeconds,
}: {
  callings: Calling[];
  positionSeconds: number;
}) {
  const { current, next, secondsToNext, segmentProgress } = resolveCallings(
    callings,
    positionSeconds,
  );

  // Countdown ring fills as we approach the next calling.
  const ringPct = Math.round(segmentProgress * 100);
  const imminent = secondsToNext !== null && secondsToNext <= 4;

  return (
    <div className="calling-display">
      <div className="now">
        <span className="label">NOW</span>
        <span className="step">{current ? current.step : '—'}</span>
        {current?.cue && <span className="cue">{current.cue}</span>}
      </div>

      <div className={`countdown ${imminent ? 'imminent' : ''}`}>
        <div
          className="ring"
          style={{
            background: `conic-gradient(var(--accent) ${ringPct}%, var(--ring-bg) ${ringPct}%)`,
          }}
        >
          <div className="ring-inner">
            {secondsToNext !== null ? (
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

      <div className="next">
        <span className="label">NEXT</span>
        <span className="step-next">{next ? next.step : 'End of track'}</span>
        {next?.cue && <span className="cue">{next.cue}</span>}
      </div>
    </div>
  );
}
