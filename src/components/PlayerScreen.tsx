import { useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../data/tracks';
import { buildCallings } from '../data/beats';
import { formatClock, formatLong, formatTimeOfDay } from '../data/time';
import { usePlayerEngine, DEFAULT_GAP_SECONDS } from '../hooks/usePlayerEngine';
import { useTrackMeta } from '../hooks/useTrackMeta';
import { useCalibration } from '../hooks/useCalibration';
import { useWakeLock } from '../hooks/useWakeLock';
import { useCopyFlag } from '../hooks/useCopyFlag';
import { useSyncOffset } from '../hooks/useSyncOffset';
import CallingDisplay from './CallingDisplay';
import TapToTime from './TapToTime';
import PlayerControls from './player/PlayerControls';
import StepTimeline from './player/StepTimeline';
import SyncOffsetSlider from './player/SyncOffsetSlider';
import VolumeSlider from './player/VolumeSlider';
import CalibrationPanel from './player/CalibrationPanel';
import GapOverlay from './player/GapOverlay';
import HeldOverlay from './player/HeldOverlay';
import EndedOverlay from './player/EndedOverlay';
import DeviceBanners from './player/DeviceBanners';
import { Pause, Link as LinkIcon, AlertTriangle, Pen } from './icons';
import { trackPath } from '../nav/routes';
import { sessionEstimate } from '../data/setlist';

export default function PlayerScreen({
  tracks,
  startIndex,
  deviceId,
  mode = 'start',
  session,
  onBack,
  onUpdateTrack,
  onEdit,
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
  /** Open the routine editor for a track (the detail-page pen button). */
  onEdit?: (trackId: string) => void;
}) {
  // The session's gap must reach the engine, or the countdown would run the
  // default while the session estimate uses the authored value.
  const gapSeconds = session?.gapSeconds ?? DEFAULT_GAP_SECONDS;
  const engine = usePlayerEngine(tracks, deviceId, gapSeconds);
  useWakeLock(true);

  const [tapping, setTapping] = useState(false);
  const [offsetMs, setOffsetMs] = useSyncOffset();

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

  const [linkCopied, copyText] = useCopyFlag();
  // Share a deep link to this track's detail page: native share sheet where
  // the Web Share API exists (iOS Safari 14.5+, Android), clipboard otherwise.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareLink = () => {
    const url = window.location.origin + trackPath(track.id, import.meta.env.BASE_URL);
    if (canShare) {
      // Rejection = user closed the sheet; nothing to handle.
      navigator.share({ title: meta.title, url }).catch(() => {});
    } else {
      copyText(url);
    }
  };

  // Which calling row is active (for the coach timeline highlight).
  let activeRow = -1;
  for (let i = 0; i < callings.length; i++) {
    if (callings[i].time <= positionSeconds) activeRow = i;
    else break;
  }

  // Seek so a tapped step becomes the audible "now": the sync offset is
  // subtracted because positionSeconds = (rawPosition + offset).
  const seekToCalling = (timeSeconds: number) => engine.seekTo(timeSeconds * 1000 - offsetMs);

  return (
    <div className="player">
      <header className="topbar">
        <button className="link" onClick={onBack}>
          ‹ Tracks
        </button>
        <div className="topbar-end">
          <span className="device-tag">{engine.deviceName ?? 'No device'}</span>
          <button
            className={`keepawake-chip${engine.keepAwake ? ' on' : ''}`}
            onClick={() => engine.setKeepAwake(!engine.keepAwake)}
            aria-pressed={engine.keepAwake}
            title={
              engine.keepAwake
                ? `Keeping the device awake between tracks (${
                    engine.keepAwakeMethod === 'silent' ? 'silent track' : 'no-audio ping'
                  }). Tap to turn off.`
                : 'Keep-awake is off — the device may sleep between tracks. Tap to turn on.'
            }
          >
            {engine.keepAwake
              ? engine.keepAwakeMethod === 'silent'
                ? 'awake · silent'
                : 'awake'
              : 'awake off'}
          </button>
          {onEdit && (
            <button
              className="icon-btn"
              onClick={() => onEdit(track.id)}
              aria-label="Edit routine"
              title="Edit routine"
            >
              <Pen size={18} />
            </button>
          )}
        </div>
      </header>

      {sessionView && (
        <div className="session-bar">
          <span className="session-pos">
            Setlist · {engine.index + 1}/{sessionView.count}
          </span>
          <span className="muted">
            ~{formatLong(sessionView.remainingMs)} left · ends{' '}
            {formatTimeOfDay(Date.now() + sessionView.remainingMs)} ·{' '}
            {formatLong(sessionView.totalMs)} total
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
        <button className="link copy-link" onClick={shareLink}>
          <LinkIcon size={16} />
          {canShare
            ? 'Share this track'
            : linkCopied
              ? 'Link copied!'
              : 'Copy link to this track'}
        </button>
      </div>

      {engine.error && <p className="error">{engine.error}</p>}

      <DeviceBanners
        noDevice={engine.noDevice}
        hijacked={engine.hijacked}
        deviceName={engine.deviceName}
        onBack={onBack}
        onRecover={engine.recover}
      />

      <CallingDisplay
        callings={callings}
        positionSeconds={positionSeconds}
        bpm={meta.bpm ?? undefined}
      />

      <div className="progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          {/* Step boundaries as tick marks, so "where does the chorus land"
              reads off the bar. Sync offset applies (same clock as seeking). */}
          {duration > 0 &&
            callings.map((c, i) => {
              const pct = ((c.time * 1000 - offsetMs) / duration) * 100;
              if (pct <= 0 || pct >= 100) return null;
              return <span key={i} className="progress-tick" style={{ left: `${pct}%` }} />;
            })}
        </div>
        <div className="progress-times">
          <span>{formatClock(engine.positionMs)}</span>
          <span>{formatClock(duration)}</span>
        </div>
      </div>

      <PlayerControls
        phase={engine.phase}
        onPrev={engine.prev}
        onNext={engine.next}
        onPlayPause={
          engine.phase === 'idle' ? () => engine.start(engine.index) : engine.togglePlayPause
        }
      />

      <VolumeSlider volumePercent={engine.volumePercent} onChange={engine.setVolume} />

      <StepTimeline
        callings={callings}
        steps={track.steps}
        activeRow={activeRow}
        phase={engine.phase}
        onSeek={seekToCalling}
      />

      <div className="continue-row">
        <label className="toggle-row">
          <span>Auto-continue ({gapSeconds}s gap)</span>
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

      <SyncOffsetSlider offsetMs={offsetMs} onChange={setOffsetMs} />

      <CalibrationPanel
        track={track}
        meta={meta}
        cal={cal}
        phase={engine.phase}
        positionSeconds={positionSeconds}
        updateCal={updateCal}
        clearCal={clearCal}
      />

      {canTapTime && (
        <button className="hold-btn" onClick={() => setTapping(true)}>
          Tap-to-time the steps
        </button>
      )}

      {engine.phase === 'gap' && (
        <GapOverlay
          gapRemaining={engine.gapRemaining}
          onExtend={engine.extendGap}
          onHold={engine.holdNow}
          onSkip={engine.skipGap}
        />
      )}

      {engine.phase === 'held' && (
        <HeldOverlay
          keepAwake={engine.keepAwake}
          silent={engine.keepAwakeMethod === 'silent'}
          deviceName={engine.deviceName}
          deviceAsleep={engine.deviceAsleep}
          onContinue={engine.skipGap}
          onRecheck={engine.recheckDevice}
          onStopSilent={() => engine.setKeepAwakeMethod('ping')}
          onBack={onBack}
        />
      )}

      {engine.phase === 'ended' && (
        <EndedOverlay
          session={
            sessionView ? { count: sessionView.count, totalMs: sessionView.totalMs } : null
          }
          onReplay={() => engine.start(engine.index)}
          onRestartSession={() => engine.start(0)}
          onBack={onBack}
        />
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

      {import.meta.env.DEV && (
        <div className="debug">
          phase: {engine.phase} · raw {formatClock(engine.positionMs)} · device{' '}
          {engine.deviceName ?? '—'}
        </div>
      )}
    </div>
  );
}
