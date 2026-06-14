import { useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../data/tracks';
import { buildCallings } from '../data/beats';
import { getTrackTempo } from '../spotify/api';
import { usePlayerEngine } from '../hooks/usePlayerEngine';
import { useWakeLock } from '../hooks/useWakeLock';
import CallingDisplay from './CallingDisplay';

const OFFSET_KEY = 'tjf.syncOffsetMs';

function fmt(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerScreen({
  tracks,
  startIndex,
  deviceId,
  onBack,
}: {
  tracks: Track[];
  startIndex: number;
  deviceId: string | null;
  onBack: () => void;
}) {
  const engine = usePlayerEngine(tracks, deviceId);
  useWakeLock(true);

  // Sync offset compensates for Bluetooth speaker latency (display vs. audible).
  const [offsetMs, setOffsetMs] = useState<number>(() =>
    Number(localStorage.getItem(OFFSET_KEY) ?? '0'),
  );
  useEffect(() => {
    localStorage.setItem(OFFSET_KEY, String(offsetMs));
  }, [offsetMs]);

  // Kick off playback once when the screen opens.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      engine.start(startIndex);
    }
  }, [engine, startIndex]);

  const track = engine.track;

  // Resolve BPM: a manual value always wins; otherwise try Spotify (which may
  // be unavailable for newer apps). Callings are derived from steps + BPM.
  const [bpm, setBpm] = useState<number | null>(track.bpm ?? null);
  useEffect(() => {
    if (track.bpm) {
      setBpm(track.bpm);
      return;
    }
    setBpm(null);
    let active = true;
    getTrackTempo(track.spotifyUri)
      .then((tempo) => active && setBpm(tempo))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [track.spotifyUri, track.bpm]);

  const callings = useMemo(
    () => (bpm ? buildCallings(track.steps, track.firstBeatSec, bpm) : []),
    [track, bpm],
  );

  const positionSeconds = (engine.positionMs + offsetMs) / 1000;
  const duration = track.durationMs;
  const progressPct = duration > 0 ? Math.min(100, (engine.positionMs / duration) * 100) : 0;

  const playLabel =
    engine.phase === 'playing'
      ? 'Pause'
      : engine.phase === 'paused'
        ? 'Resume'
        : engine.phase === 'ended'
          ? 'Replay'
          : 'Play';

  // Which calling row is active (for the coach timeline highlight).
  let activeRow = -1;
  for (let i = 0; i < callings.length; i++) {
    if (callings[i].time <= positionSeconds) activeRow = i;
    else break;
  }

  return (
    <div className="player">
      <header className="topbar">
        <button className="link" onClick={onBack}>
          ‹ Tracks
        </button>
        <span className="device-tag">{engine.deviceName ?? 'No device'}</span>
      </header>

      <div className="track-head">
        <h2>{track.title}</h2>
        <span className="track-artist">
          {track.artist}
          {bpm ? ` · ${Math.round(bpm)} BPM` : ' · detecting tempo…'}
        </span>
      </div>

      {engine.error && <p className="error">{engine.error}</p>}

      <CallingDisplay
        callings={callings}
        positionSeconds={positionSeconds}
        bpm={bpm ?? undefined}
      />

      <div className="progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="progress-times">
          <span>{fmt(engine.positionMs)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      <div className="controls">
        <button className="round" onClick={engine.prev} aria-label="Previous track">
          ⏮
        </button>
        <button className="round primary xl" onClick={engine.togglePlayPause}>
          {playLabel}
        </button>
        <button className="round" onClick={engine.next} aria-label="Next track">
          ⏭
        </button>
      </div>

      {/* The easy permanent-pause button */}
      <button className="hold-btn" onClick={engine.holdNow}>
        ⏸ Pause permanently between tracks
      </button>

      <label className="toggle-row">
        <span>Auto-continue (20s gap between tracks)</span>
        <input
          type="checkbox"
          checked={engine.autoContinue}
          onChange={(e) => engine.setAutoContinue(e.target.checked)}
        />
      </label>

      <div className="sync-row">
        <div className="sync-head">
          <span>Sync offset</span>
          <span className="muted">
            {offsetMs > 0 ? '+' : ''}
            {offsetMs} ms
          </span>
        </div>
        <input
          type="range"
          min={-1500}
          max={1500}
          step={50}
          value={offsetMs}
          onChange={(e) => setOffsetMs(Number(e.target.value))}
        />
        <p className="hint">
          Nudge if the called step is ahead of / behind what you hear on the speaker.
        </p>
      </div>

      {/* Coach view: the full prepared order of steps — tap a step to jump there */}
      <section className="timeline">
        <h3>Prepared steps</h3>
        <ol>
          {callings.map((c, i) => (
            <li key={i}>
              <button
                type="button"
                className={`row-jump${i === activeRow ? ' row-active' : ''}`}
                // Seek so this step becomes the audible "now": the sync offset is
                // subtracted because positionSeconds = (rawPosition + offset).
                onClick={() => engine.seekTo(c.time * 1000 - offsetMs)}
                disabled={engine.phase !== 'playing' && engine.phase !== 'paused'}
              >
                <span className="row-time">{fmt(c.time * 1000)}</span>
                <span className="row-step">{c.step}</span>
                {c.cue && <span className="row-cue">{c.cue}</span>}
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* Gap / held overlays */}
      {engine.phase === 'gap' && (
        <div className="overlay">
          <div className="overlay-card">
            <span className="muted">Next track in</span>
            <span className="gap-num">{engine.gapRemaining}</span>
            <div className="overlay-actions">
              <button className="ghost" onClick={engine.holdNow}>
                Hold
              </button>
              <button className="primary" onClick={engine.skipGap}>
                Start now
              </button>
            </div>
          </div>
        </div>
      )}

      {engine.phase === 'held' && (
        <div className="overlay">
          <div className="overlay-card">
            <span className="muted">Paused between tracks</span>
            <button className="primary big" onClick={engine.skipGap}>
              Continue ▶
            </button>
          </div>
        </div>
      )}

      <div className="debug">
        phase: {engine.phase} · raw {fmt(engine.positionMs)} · device{' '}
        {engine.deviceName ?? '—'}
      </div>
    </div>
  );
}
