import { useRef, useState } from 'react';
import type { StepCalling } from '../data/tracks';
import { bpmFromTaps, tapsToTiming } from '../data/tapTiming';

const TEMPO_RESET_MS = 2000; // start a fresh tempo-tap series after this gap

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The one guided timing flow (editor overlay), merging the old player-side
 * "Tap tempo" / "Mark first beat" / "Tap-to-time the steps" into stops of a
 * single activity:
 *
 *   1. Tempo — only when no BPM is known: tap along, "Use N BPM".
 *   2. First beat — playback runs; the first tap on count 1 is the first beat
 *      AND tap #1 of the step timing, so "Save first beat & done" (the common
 *      case: measures already authored) needs exactly one tap.
 *   3. Steps — keep tapping each step change + one final end tap, save all.
 *
 * Everything lands in the editor draft via the onApply/onSave callbacks —
 * there is no second store; review the fields and hit the editor's Save.
 */
export default function TimingFlow({
  steps,
  bpm,
  positionSeconds,
  playing,
  error,
  onStart,
  onApplyBpm,
  onSaveFirstBeat,
  onSaveTiming,
  onClose,
}: {
  steps: StepCalling[];
  /** BPM the draft currently has (authored or recommended), if any. */
  bpm: number | null;
  /** Live playback position (display seconds) — read at each tap. */
  positionSeconds: number;
  playing: boolean;
  /** Playback error from the timing-playback hook (e.g. no device). */
  error: string | null;
  /** (Re)start the track from the top. */
  onStart: () => void;
  onApplyBpm: (bpm: number) => void;
  onSaveFirstBeat: (firstBeatSec: number) => void;
  onSaveTiming: (firstBeatSec: number, measures: number[]) => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<'tempo' | 'tap'>(bpm == null ? 'tempo' : 'tap');
  // The BPM the step math uses — the prop, or what the tempo stop produced.
  const [flowBpm, setFlowBpm] = useState<number | null>(bpm);

  // Tempo stop: wall-clock taps (performance.now), independent of playback.
  const tempoTapsRef = useRef<number[]>([]);
  const [tempoBpm, setTempoBpm] = useState<number | null>(null);
  const tapTempo = () => {
    const now = performance.now();
    const t = tempoTapsRef.current;
    if (t.length && now - t[t.length - 1] > TEMPO_RESET_MS) t.length = 0;
    t.push(now);
    if (t.length > 8) t.shift();
    setTempoBpm(bpmFromTaps(t));
  };
  const useTempo = () => {
    if (!tempoBpm) return;
    onApplyBpm(tempoBpm);
    setFlowBpm(tempoBpm);
    setStage('tap');
  };

  // Tap stop: playback-position taps. Tap #1 = first beat; without a BPM the
  // step math is impossible, so the series is capped at that one tap.
  const [taps, setTaps] = useState<number[]>([]);
  const totalTaps = flowBpm != null ? steps.length + 1 : 1;
  const done = taps.length >= totalTaps;
  const { firstBeatSec, measures } = tapsToTiming(taps, flowBpm ?? 0);
  const tap = () => {
    if (!done && playing) setTaps((t) => [...t, Math.max(0, positionSeconds)]);
  };
  const restart = () => {
    setTaps([]);
    onStart();
  };

  const nextLabel =
    taps.length === 0
      ? `Tap on count 1${steps[0]?.step ? ` — ${steps[0].step}` : ''}`
      : done
        ? 'Done — save below'
        : taps.length < steps.length
          ? `Tap: ${steps[taps.length].step}`
          : 'Tap: Finish (end)';

  return (
    <div className="overlay">
      <div className="overlay-card tap-card">
        <div className="tap-head">
          <span className="muted">Time this track</span>
          <span className="muted">
            {positionSeconds.toFixed(1)}s · {flowBpm != null ? `${Math.round(flowBpm)} BPM` : 'no BPM'}
          </span>
        </div>

        {stage === 'tempo' ? (
          <>
            <button className="tap-big primary" onClick={tapTempo}>
              <span>Tap the tempo</span>
              <span className="tap-progress">{tempoBpm ? `${tempoBpm} BPM` : '—'}</span>
            </button>
            <p className="hint">
              Tap along to the beat a few times (the music just needs to be audible — playback
              position doesn’t matter here).
            </p>
            <div className="overlay-actions">
              <button className="ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="ghost" onClick={() => setStage('tap')}>
                Skip — first beat only
              </button>
              <button className="primary" onClick={useTempo} disabled={!tempoBpm}>
                Use {tempoBpm ?? '—'} BPM
              </button>
            </div>
          </>
        ) : (
          <>
            {flowBpm != null && (
              <ol className="tap-steps">
                {/* The highlighted step is the one whose start the next tap marks. */}
                {steps.map((s, i) => (
                  <li key={i} className={!done && i === taps.length ? 'tap-target' : ''}>
                    <span className="row-step">{s.step}</span>
                    <span className="row-measures">{measures[i] != null ? measures[i] : '—'}</span>
                  </li>
                ))}
              </ol>
            )}

            <button className="tap-big primary" onClick={tap} disabled={done || !playing}>
              <span>{playing ? nextLabel : 'Start playback first'}</span>
              <span className="tap-progress">
                {Math.min(taps.length, totalTaps)}/{totalTaps}
              </span>
            </button>

            <div className="tap-actions">
              <button className="ghost" onClick={() => setTaps((t) => t.slice(0, -1))} disabled={taps.length === 0}>
                Undo
              </button>
              <button className="ghost" onClick={restart}>
                {playing ? 'Restart track' : 'Start playback'}
              </button>
              <button className="link" onClick={() => setStage('tempo')}>
                Re-tap tempo
              </button>
            </div>

            {error && <p className="hint warning">⚠ {error}</p>}
            <p className="hint">
              {flowBpm == null
                ? 'No BPM — only the first beat can be captured. Re-tap tempo to time the steps too.'
                : taps.length === 0
                  ? 'Play from the top and tap exactly on count 1. One tap is enough for the first beat; keep tapping on each step change (plus once at the very end) to time the whole routine.'
                  : `1st beat → ${firstBeatSec.toFixed(2)}s. Restarting the track clears the taps.`}
            </p>

            <div className="overlay-actions">
              <button className="ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="ghost"
                disabled={taps.length === 0}
                onClick={() => {
                  onSaveFirstBeat(round2(firstBeatSec));
                  onClose();
                }}
              >
                Save first beat &amp; done
              </button>
              {flowBpm != null && (
                <button
                  className="primary"
                  disabled={taps.length !== totalTaps}
                  onClick={() => {
                    onSaveTiming(round2(firstBeatSec), measures);
                    onClose();
                  }}
                >
                  Save timing
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
