import { useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../data/tracks';
import { buildCallings, beatsForStep } from '../data/beats';
import { bpmFromTaps } from '../data/calibration';
import { usePlayerEngine } from '../hooks/usePlayerEngine';
import { useTrackMeta } from '../hooks/useTrackMeta';
import { useCalibration } from '../hooks/useCalibration';
import { useWakeLock } from '../hooks/useWakeLock';
import { useCopyFlag } from '../hooks/useCopyFlag';
import CallingDisplay from './CallingDisplay';
import TapToTime from './TapToTime';
import { SkipBack, SkipForward, Pause, Play, Link as LinkIcon, AlertTriangle } from './icons';
import { trackPath } from '../nav/routes';
import { sessionEstimate } from '../data/setlist';

const OFFSET_KEY = 'tjf.syncOffsetMs';
const TAP_RESET_MS = 2000; // start a fresh tap series after this gap

function fmt(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Like fmt but with an hours field for long session totals (H:MM:SS). */
function fmtLong(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerScreen({
  tracks,
  startIndex,
  deviceId,
  mode = 'start',
  session,
  onBack,
  onUpdateTrack,
}: {
  tracks: Track[];
  startIndex: number;
  deviceId: string | null;
  /** Present when launched as a setlist session: per-track durations + the gap. */
  session?: { durationsMs: number[]; gapSeconds: number };
  /**
   * How to open: 'start' plays from the top (list click), 'resume' attaches to
   * already-running playback (session resume), 'view' shows the track quietly
   * without playing (a deep-linked detail page — user presses Play).
   */
  mode?: 'start' | 'resume' | 'view';
  onBack: () => void;
  /** Persist edits to a track (used by tap-to-time). */
  onUpdateTrack?: (index: number, track: Track) => void;
}) {
  const engine = usePlayerEngine(tracks, deviceId);
  useWakeLock(true);

  const [tapping, setTapping] = useState(false);

  // Sync offset compensates for Bluetooth speaker latency (display vs. audible).
  const [offsetMs, setOffsetMs] = useState<number>(() =>
    Number(localStorage.getItem(OFFSET_KEY) ?? '0'),
  );
  useEffect(() => {
    localStorage.setItem(OFFSET_KEY, String(offsetMs));
  }, [offsetMs]);

  // Kick off playback once when the screen opens — or attach to the running
  // track when resuming a session after a reload.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      if (mode === 'resume') engine.attach(startIndex);
      else if (mode === 'view') engine.select(startIndex);
      else engine.start(startIndex);
    }
  }, [engine, startIndex, mode]);

  const track = engine.track;

  // Title/artist/duration come from Spotify; BPM + first beat are tapped in by
  // the coach (saved calibration) since Spotify's tempo endpoints are gone.
  const { cal, update: updateCal, clear: clearCal } = useCalibration(track.spotifyUri);
  const meta = useTrackMeta(track, cal);

  const callings = useMemo(
    () => (meta.bpm ? buildCallings(track.steps, meta.firstBeatSec, meta.bpm) : []),
    [track, meta.bpm, meta.firstBeatSec],
  );

  const positionSeconds = (engine.positionMs + offsetMs) / 1000;

  // Tap-to-time: write the captured first beat + per-step measures back to the
  // track. Only enabled when a BPM is known and a persist callback is wired.
  const canTapTime = onUpdateTrack != null && meta.bpm != null;
  const saveTapTiming = (firstBeatSec: number, measures: number[]) => {
    onUpdateTrack?.(engine.index, {
      ...track,
      firstBeatSec,
      steps: track.steps.map((s, i) => ({ ...s, measures: measures[i] ?? s.measures })),
    });
    setTapping(false);
  };
  // Session (setlist) progress estimate. Refine the current track's duration
  // with the live value from Spotify when we have it.
  const sessionView = (() => {
    if (!session) return null;
    const durs = session.durationsMs.slice();
    if (engine.durationMs > 0 && engine.index < durs.length) durs[engine.index] = engine.durationMs;
    const est = sessionEstimate(durs, engine.index, engine.positionMs, session.gapSeconds);
    return { ...est, count: session.durationsMs.length };
  })();

  // Prefer the live Spotify duration; fall back to fetched/authored metadata.
  const duration = engine.durationMs || meta.durationMs;
  const progressPct = duration > 0 ? Math.min(100, (engine.positionMs / duration) * 100) : 0;

  // Where the active BPM / first beat come from (authored wins over a tap).
  const bpmAuthored = track.bpm != null;
  const firstBeatAuthored = track.firstBeatSec != null;
  const bpmSource = bpmAuthored
    ? 'authored'
    : cal?.bpm != null
      ? 'tapped'
      : meta.bpm != null
        ? 'Spotify'
        : null;
  const firstBeatSource = firstBeatAuthored
    ? 'authored'
    : cal?.firstBeatSec != null
      ? 'tapped'
      : 'default';

  // --- Tap tempo + downbeat calibration --------------------------------------
  const tapsRef = useRef<number[]>([]);
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [linkCopied, copyText] = useCopyFlag();

  // Copy a shareable deep link to this track's detail page.
  const copyLink = () =>
    copyText(window.location.origin + trackPath(track.id, import.meta.env.BASE_URL));

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

  // Keep the active step centered in the scrollable "Prepared steps" list.
  const stepListRef = useRef<HTMLOListElement | null>(null);
  const activeRowRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    const li = activeRowRef.current;
    const ol = stepListRef.current;
    if (!li || !ol) return;
    const target = li.offsetTop - (ol.clientHeight - li.offsetHeight) / 2;
    ol.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeRow]);

  return (
    <div className="player">
      <header className="topbar">
        <button className="link" onClick={onBack}>
          ‹ Tracks
        </button>
        <span className="device-tag">{engine.deviceName ?? 'No device'}</span>
      </header>

      {sessionView && (
        <div className="session-bar">
          <span className="session-pos">
            Setlist · {engine.index + 1}/{sessionView.count}
          </span>
          <span className="muted">
            ~{fmtLong(sessionView.remainingMs)} left · {fmtLong(sessionView.totalMs)} total
          </span>
        </div>
      )}

      <div className="track-head">
        {meta.imageUrl && (
          <img className="player-art" src={meta.imageUrl} alt="" loading="lazy" />
        )}
        <h2>{meta.title}</h2>
        <span className="track-artist">
          {meta.artist}
          {meta.bpm ? ` · ${Math.round(meta.bpm)} BPM` : ' · detecting tempo…'}
        </span>
        {track?.wip && (
          <p className="wip-note">
            <AlertTriangle size={16} /> Work in progress — timings may be off.
          </p>
        )}
        <button className="link copy-link" onClick={copyLink}>
          <LinkIcon size={16} />
          {linkCopied ? 'Link copied!' : 'Copy link to this track'}
        </button>
      </div>

      {engine.error && <p className="error">{engine.error}</p>}

      {engine.noDevice && (
        <div className="device-lost">
          <span>
            Lost the playback device. Open Spotify on your tablet (and press play), or
            reconnect:
          </span>
          <div className="device-lost-actions">
            <button className="ghost" onClick={onBack}>
              Devices
            </button>
            <button className="primary" onClick={engine.recover}>
              Reconnect
            </button>
          </div>
        </div>
      )}

      {engine.hijacked && !engine.noDevice && (
        <div className="device-lost">
          <span>
            Another app took over playback — a different track is playing. Take back
            control of this device:
          </span>
          <div className="device-lost-actions">
            <button className="primary" onClick={engine.recover}>
              Take back control
            </button>
          </div>
        </div>
      )}

      <CallingDisplay
        callings={callings}
        positionSeconds={positionSeconds}
        bpm={meta.bpm ?? undefined}
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
          <SkipBack />
        </button>
        <button
          className="round primary xl"
          onClick={
            engine.phase === 'idle' ? () => engine.start(engine.index) : engine.togglePlayPause
          }
        >
          {playLabel}
        </button>
        <button className="round" onClick={engine.next} aria-label="Next track">
          <SkipForward />
        </button>
      </div>

      {/* Coach view: the full prepared order of steps — tap a step to jump there */}
      <section className="timeline">
        <h3>Prepared steps</h3>
        <ol ref={stepListRef}>
          {callings.map((c, i) => (
            <li key={i} ref={i === activeRow ? activeRowRef : null}>
              <button
                type="button"
                className={`row-jump${i === activeRow ? ' row-active' : ''}`}
                // Seek so this step becomes the audible "now": the sync offset is
                // subtracted because positionSeconds = (rawPosition + offset).
                onClick={() => engine.seekTo(c.time * 1000 - offsetMs)}
                disabled={engine.phase !== 'playing' && engine.phase !== 'paused'}
              >
                <span className="row-time">
                  <span className="row-secs">{fmt(c.time * 1000)}</span>
                  <span className="row-beats">{beatsForStep(track.steps[i]?.measures ?? 0)} beats</span>
                </span>
                <span className="row-step">{c.step}</span>
                {c.cue && <span className="row-cue">{c.cue}</span>}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div className="continue-row">
        <label className="toggle-row">
          <span>Auto-continue (20s gap)</span>
          <input
            type="checkbox"
            checked={engine.autoContinue}
            onChange={(e) => engine.setAutoContinue(e.target.checked)}
          />
        </label>
        {/* End the current song now and hold before the next track */}
        <button className="hold-btn" onClick={engine.holdNow}>
          <Pause size={18} /> End track &amp; hold
        </button>
      </div>

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

      {/* Tap-tempo calibration (Spotify's tempo endpoints are gone) */}
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
          <button
            className="ghost"
            onClick={saveTappedBpm}
            disabled={!tapBpm || bpmAuthored}
          >
            Save BPM
          </button>
          <button
            className="ghost"
            onClick={markFirstBeat}
            disabled={
              firstBeatAuthored ||
              (engine.phase !== 'playing' && engine.phase !== 'paused')
            }
          >
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
            ? 'Authored in tracks.ts (overrides tapping) — clear it there to calibrate by ear.'
            : 'Tap along to the beat a few times, Save, then tap “Mark first beat” on count 1. Saved per track on this device.'}
        </p>
      </div>

      {canTapTime && (
        <button className="hold-btn" onClick={() => setTapping(true)}>
          Tap-to-time the steps
        </button>
      )}

      {/* Gap / held overlays */}
      {engine.phase === 'gap' && (
        <div className="overlay">
          <div className="overlay-card">
            <span className="muted">Next track in</span>
            <span className="gap-num">{engine.gapRemaining}</span>
            <button className="add-time" onClick={() => engine.extendGap(5)}>
              +5s
            </button>
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
              Continue <Play size={18} />
            </button>
            <button className="link" onClick={onBack}>
              End session · back to list
            </button>
          </div>
        </div>
      )}

      {tapping && meta.bpm != null && (
        <TapToTime
          steps={track.steps}
          bpm={meta.bpm}
          positionSeconds={positionSeconds}
          onRestart={() => engine.seekTo(0)}
          onSave={saveTapTiming}
          onCancel={() => setTapping(false)}
        />
      )}

      <div className="debug">
        phase: {engine.phase} · raw {fmt(engine.positionMs)} · device{' '}
        {engine.deviceName ?? '—'}
      </div>
    </div>
  );
}
