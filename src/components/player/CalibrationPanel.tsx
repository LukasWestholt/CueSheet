import { useRef, useState } from 'react';
import type { Track } from '../../data/tracks';
import type { ResolvedMeta } from '../../data/meta';
import type { Calibration } from '../../data/calibration';
import type { Phase } from '../../hooks/usePlayerEngine';
import { bpmFromTaps } from '../../data/calibration';

const TAP_RESET_MS = 2000; // start a fresh tap series after this gap

/**
 * Tap-tempo + first-beat calibration (Spotify's tempo endpoints are gone). Owns
 * the tap series locally; persists through `updateCal`/`clearCal`. Authored
 * BPM/first-beat win over taps, which disables saving.
 */
export default function CalibrationPanel({
  track,
  meta,
  cal,
  phase,
  positionSeconds,
  updateCal,
  clearCal,
}: {
  track: Track;
  meta: ResolvedMeta;
  cal: Calibration | null;
  phase: Phase;
  positionSeconds: number;
  updateCal: (patch: Calibration) => void;
  clearCal: () => void;
}) {
  const tapsRef = useRef<number[]>([]);
  const [tapBpm, setTapBpm] = useState<number | null>(null);

  const bpmAuthored = track.bpm != null;
  const firstBeatAuthored = track.firstBeatSec != null;
  const bpmSource = bpmAuthored
    ? 'authored'
    : cal?.bpm != null
      ? 'tapped'
      : meta.bpm != null
        ? 'Spotify'
        : null;
  const firstBeatSource = firstBeatAuthored ? 'authored' : cal?.firstBeatSec != null ? 'tapped' : 'default';
  const liveOrPaused = phase === 'playing' || phase === 'paused';

  const onTap = () => {
    const now = performance.now();
    const taps = tapsRef.current;
    if (taps.length && now - taps[taps.length - 1] > TAP_RESET_MS) taps.length = 0;
    taps.push(now);
    if (taps.length > 8) taps.shift();
    setTapBpm(bpmFromTaps(taps));
  };
  const saveTappedBpm = () => {
    if (tapBpm) updateCal({ bpm: tapBpm });
    tapsRef.current = [];
    setTapBpm(null);
  };
  const markFirstBeat = () => updateCal({ firstBeatSec: Math.max(0, positionSeconds) });

  return (
    <div className="calib-row">
      <div className="sync-head">
        <span>Tempo &amp; first beat</span>
        <span className="muted">
          {meta.bpm ? `${Math.round(meta.bpm)} BPM` : 'no BPM'}
          {bpmSource ? ` (${bpmSource})` : ''} ·{' '}
          {`1st @ ${meta.firstBeatSec.toFixed(2)}s (${firstBeatSource})`}
        </span>
      </div>
      <div className="calib-actions">
        <button className="tap-btn" onClick={onTap}>
          Tap tempo
          <span className="tap-bpm">{tapBpm ? `${tapBpm}` : '—'}</span>
        </button>
        <button className="ghost" onClick={saveTappedBpm} disabled={!tapBpm || bpmAuthored}>
          Save BPM
        </button>
        <button className="ghost" onClick={markFirstBeat} disabled={firstBeatAuthored || !liveOrPaused}>
          Mark first beat
        </button>
      </div>
      {cal && (
        <div className="calib-foot">
          <button className="link" onClick={clearCal}>
            Clear
          </button>
        </div>
      )}
      <p className="hint">
        {bpmAuthored || firstBeatAuthored
          ? 'This routine sets the BPM / first beat, which overrides tap calibration. Edit the routine to change it.'
          : 'Tap along to the beat a few times, Save, then tap “Mark first beat” on count 1. Saved per track on this device.'}
      </p>
    </div>
  );
}
