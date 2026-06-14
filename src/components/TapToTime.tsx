import { useMemo, useState } from 'react';
import type { StepCalling } from '../data/tracks';
import { tapsToTiming } from '../data/tapTiming';

export default function TapToTime({
  steps,
  bpm,
  positionSeconds,
  onRestart,
  onSave,
  onCancel,
}: {
  steps: StepCalling[];
  bpm: number;
  /** Live playback position (display seconds) — read at each tap. */
  positionSeconds: number;
  onRestart: () => void;
  onSave: (firstBeatSec: number, measures: number[]) => void;
  onCancel: () => void;
}) {
  const [taps, setTaps] = useState<number[]>([]);
  const totalTaps = steps.length + 1; // a start for each step + one final "end"
  const done = taps.length >= totalTaps;
  const { firstBeatSec, measures } = useMemo(() => tapsToTiming(taps, bpm), [taps, bpm]);

  const tap = () => {
    if (!done) setTaps((t) => [...t, Math.max(0, positionSeconds)]);
  };

  const nextLabel = done
    ? 'Done — Save below'
    : taps.length < steps.length
      ? `Tap: ${steps[taps.length].step}`
      : 'Tap: Finish (end)';

  return (
    <div className="overlay">
      <div className="overlay-card tap-card">
        <div className="tap-head">
          <span className="muted">Tap-to-time</span>
          <span className="muted">
            {positionSeconds.toFixed(1)}s · {Math.round(bpm)} BPM
          </span>
        </div>

        <ol className="tap-steps">
          {steps.map((s, i) => (
            <li key={i} className={!done && i === taps.length ? 'tap-target' : ''}>
              <span className="row-step">{s.step}</span>
              <span className="row-measures">{measures[i] != null ? measures[i] : '—'}</span>
            </li>
          ))}
        </ol>

        <button className="tap-big primary" onClick={tap} disabled={done}>
          <span>{nextLabel}</span>
          <span className="tap-progress">
            {Math.min(taps.length, totalTaps)}/{totalTaps}
          </span>
        </button>

        <div className="tap-actions">
          <button className="ghost" onClick={() => setTaps((t) => t.slice(0, -1))} disabled={taps.length === 0}>
            Undo
          </button>
          <button className="ghost" onClick={() => setTaps([])} disabled={taps.length === 0}>
            Reset
          </button>
          <button className="ghost" onClick={onRestart}>
            Restart track
          </button>
        </div>

        <p className="hint">
          Play from the top and tap on each step change, then one final tap at the very
          end. 1st beat → {firstBeatSec.toFixed(2)}s.
        </p>

        <div className="overlay-actions">
          <button className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={() => onSave(firstBeatSec, measures)}
            disabled={taps.length !== totalTaps}
          >
            Save timing
          </button>
        </div>
      </div>
    </div>
  );
}
