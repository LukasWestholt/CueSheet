import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '../data/tracks';
import { interpolatePosition } from '../playback/position';
import {
  getDevices,
  getPlaybackState,
  pause as apiPause,
  playTrack,
  resume as apiResume,
  seek as apiSeek,
  type PlaybackSnapshot,
} from '../spotify/api';

export type Phase =
  | 'idle' // nothing started yet
  | 'loading' // sent play command, waiting for first state
  | 'playing'
  | 'paused' // paused mid-track by the user
  | 'gap' // 20s countdown between tracks
  | 'held' // permanently paused between tracks (auto-continue cancelled)
  | 'ended'; // last track finished, nothing queued

const POLL_MS = 1000; // how often we ask Spotify for the true position
const TICK_MS = 100; // how often we re-render the interpolated position
const END_GUARD_MS = 500; // treat as ended this close to the track's end
const NO_DEVICE_NULLS = 2; // consecutive empty polls before declaring the device lost
const HIJACK_POLLS = 3; // consecutive wrong-track polls before declaring a hijack

/** Default inter-track gap (seconds). Exported so session estimates stay in sync. */
export const DEFAULT_GAP_SECONDS = 10;
const PREV_TRACK_WINDOW_MS = 3000; // a 2nd "prev" within this jumps to the previous track

export interface PlayerEngine {
  index: number;
  track: Track;
  phase: Phase;
  /** Interpolated playback position in ms (raw, before any sync offset). */
  positionMs: number;
  /** Live track duration in ms from Spotify (0 until first poll). */
  durationMs: number;
  gapRemaining: number;
  autoContinue: boolean;
  deviceName: string | null;
  /** True when Spotify has no active device (the tablet dropped off Connect). */
  noDevice: boolean;
  /** True when another app/user took over the device and a different track is playing. */
  hijacked: boolean;
  error: string | null;

  start: (index: number) => void;
  /** Attach to playback already running on Spotify without restarting it. */
  attach: (index: number) => void;
  /** Position on a track without playing it (for a deep-linked detail view). */
  select: (index: number) => void;
  togglePlayPause: () => void;
  next: () => void;
  prev: () => void;
  /** Jump to a raw song position (ms, before sync offset). */
  seekTo: (positionMs: number) => void;
  skipGap: () => void;
  /** Add seconds to the running inter-track gap countdown. */
  extendGap: (seconds: number) => void;
  holdNow: () => void; // the "pause permanently between tracks" button
  setAutoContinue: (v: boolean) => void;
  /** Re-acquire a playback device and resume the current track. */
  recover: () => void;
}

export function usePlayerEngine(
  tracks: Track[],
  deviceId: string | null,
  gapSeconds = DEFAULT_GAP_SECONDS,
): PlayerEngine {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [gapRemaining, setGapRemaining] = useState(gapSeconds);
  const [autoContinue, setAutoContinueState] = useState(true);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [noDevice, setNoDevice] = useState(false);
  const [hijacked, setHijacked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs mirror state so the timers/poller read fresh values without resetting.
  const indexRef = useRef(index);
  const phaseRef = useRef(phase);
  const autoRef = useRef(autoContinue);
  const snapshotRef = useRef<PlaybackSnapshot | null>(null);
  const gapDeadlineRef = useRef(0);
  const deviceIdRef = useRef(deviceId);
  const lastPrevAtRef = useRef(0);
  const noDeviceRef = useRef(noDevice);
  const nullPollsRef = useRef(0);
  const hijackedRef = useRef(hijacked);
  const wrongTrackPollsRef = useRef(0);

  indexRef.current = index;
  phaseRef.current = phase;
  autoRef.current = autoContinue;
  deviceIdRef.current = deviceId;
  noDeviceRef.current = noDevice;
  hijackedRef.current = hijacked;

  const track = tracks[index];

  const playIndex = useCallback(
    async (i: number) => {
      const t = tracks[i];
      if (!t) return;
      setIndex(i);
      indexRef.current = i;
      setPhase('loading');
      phaseRef.current = 'loading';
      setPositionMs(0);
      snapshotRef.current = null;
      setError(null);
      try {
        await playTrack(t.spotifyUri, deviceIdRef.current ?? undefined, 0);
        setPhase('playing');
        phaseRef.current = 'playing';
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('paused');
        phaseRef.current = 'paused';
      }
    },
    [tracks],
  );

  const enterGapOrEnd = useCallback(() => {
    // Stop the finished track ourselves, otherwise Spotify may loop it (repeat)
    // or roll into autoplay during the gap / after the routine ends.
    apiPause(deviceIdRef.current ?? undefined).catch(() => {});
    const hasNext = indexRef.current + 1 < tracks.length;
    if (!hasNext) {
      setPhase('ended');
      phaseRef.current = 'ended';
      return;
    }
    if (autoRef.current) {
      gapDeadlineRef.current = Date.now() + gapSeconds * 1000;
      setGapRemaining(gapSeconds);
      setPhase('gap');
      phaseRef.current = 'gap';
    } else {
      setPhase('held');
      phaseRef.current = 'held';
    }
  }, [tracks.length, gapSeconds]);

  // Poll Spotify for the authoritative playback state.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const active = ['playing', 'paused'].includes(phaseRef.current);
      if (!active) return;
      try {
        const snap = await getPlaybackState();
        if (cancelled) return;
        if (!snap) {
          // No active device — declare it lost after a couple of empty polls.
          nullPollsRef.current += 1;
          if (nullPollsRef.current >= NO_DEVICE_NULLS && !noDeviceRef.current) {
            setNoDevice(true);
          }
          return;
        }
        nullPollsRef.current = 0;
        if (noDeviceRef.current) setNoDevice(false);

        // Hijack guard: while we expect our track to be playing, Spotify reports a
        // *different* track — another app/user grabbed this Connect device. Confirm
        // across a few polls so the brief lag during our own track change isn't
        // mistaken for one.
        const expectedUri = tracks[indexRef.current]?.spotifyUri;
        if (
          phaseRef.current === 'playing' &&
          snap.trackUri &&
          expectedUri &&
          snap.trackUri !== expectedUri
        ) {
          wrongTrackPollsRef.current += 1;
          if (wrongTrackPollsRef.current >= HIJACK_POLLS && !hijackedRef.current) {
            setHijacked(true);
          }
          // Keep the last good snapshot so the display freezes instead of tracking
          // the hijacker's track position.
          return;
        }
        wrongTrackPollsRef.current = 0;
        if (hijackedRef.current) setHijacked(false);

        snapshotRef.current = snap;
        setDeviceName(snap.deviceName);
        // If Spotify reports it stopped near the end, the track finished.
        if (
          phaseRef.current === 'playing' &&
          !snap.isPlaying &&
          snap.durationMs > 0 &&
          snap.progressMs >= snap.durationMs - 2000
        ) {
          enterGapOrEnd();
        }
      } catch {
        /* transient network error — keep extrapolating */
      }
    };
    const id = setInterval(poll, POLL_MS);
    poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enterGapOrEnd, tracks]);

  // High-frequency ticker: interpolate position, run the gap countdown.
  useEffect(() => {
    const id = setInterval(() => {
      const p = phaseRef.current;

      if (p === 'playing') {
        const snap = snapshotRef.current;
        // Freeze the position while the device is lost or hijacked (our track
        // isn't the one playing).
        if (snap && !noDeviceRef.current && !hijackedRef.current) {
          const pos = interpolatePosition(snap);
          const duration = snap.durationMs || tracks[indexRef.current]?.durationMs || 0;
          setPositionMs(pos);
          setDurationMs(duration);
          if (duration > 0 && pos >= duration - END_GUARD_MS) {
            enterGapOrEnd();
          }
        }
      } else if (p === 'gap') {
        const remainingMs = gapDeadlineRef.current - Date.now();
        const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
        setGapRemaining(remaining);
        if (remainingMs <= 0) {
          void playIndex(indexRef.current + 1);
        }
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enterGapOrEnd, playIndex, tracks]);

  // ---- Controls ----------------------------------------------------------
  const start = useCallback((i: number) => void playIndex(i), [playIndex]);

  const attach = useCallback((i: number) => {
    // Re-attach to a track already playing on Spotify (e.g. after a page
    // reload) without sending a play command — the poller syncs the position.
    setIndex(i);
    indexRef.current = i;
    setError(null);
    setPhase('playing');
    phaseRef.current = 'playing';
  }, []);

  const select = useCallback((i: number) => {
    // Point the engine at a track without playing it: idle keeps both timers
    // inactive, so a deep-linked detail page shows the routine quietly until the
    // user presses Play.
    setIndex(i);
    indexRef.current = i;
    setError(null);
    setPhase('idle');
    phaseRef.current = 'idle';
  }, []);

  const togglePlayPause = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'playing') {
      apiPause(deviceIdRef.current ?? undefined).catch(() => {});
      // Freeze position at the last known value.
      const snap = snapshotRef.current;
      if (snap) {
        snapshotRef.current = { ...snap, isPlaying: false, fetchedAt: Date.now() };
      }
      setPhase('paused');
      phaseRef.current = 'paused';
    } else if (p === 'paused') {
      apiResume(deviceIdRef.current ?? undefined).catch(() => {});
      const snap = snapshotRef.current;
      if (snap) {
        snapshotRef.current = { ...snap, isPlaying: true, fetchedAt: Date.now() };
      }
      setPhase('playing');
      phaseRef.current = 'playing';
    } else if (p === 'held' || p === 'gap' || p === 'ended') {
      // Resume the routine from where we paused between tracks.
      void playIndex(indexRef.current + (p === 'ended' ? 0 : 1));
    }
  }, [playIndex]);

  const next = useCallback(() => {
    const i = Math.min(tracks.length - 1, indexRef.current + 1);
    void playIndex(i);
  }, [playIndex, tracks.length]);

  const prev = useCallback(() => {
    // First press restarts the current track; a quick second press (within
    // PREV_TRACK_WINDOW_MS) jumps to the previous track instead.
    const now = Date.now();
    const goPrevious = now - lastPrevAtRef.current < PREV_TRACK_WINDOW_MS && indexRef.current > 0;
    lastPrevAtRef.current = now;
    void playIndex(goPrevious ? indexRef.current - 1 : indexRef.current);
  }, [playIndex]);

  const seekTo = useCallback((rawPositionMs: number) => {
    const p = phaseRef.current;
    if (p !== 'playing' && p !== 'paused') return;
    const duration =
      snapshotRef.current?.durationMs || tracks[indexRef.current]?.durationMs || 0;
    const target = Math.max(0, duration > 0 ? Math.min(rawPositionMs, duration) : rawPositionMs);
    apiSeek(target, deviceIdRef.current ?? undefined).catch(() => {});
    // Reflect the new position immediately so display + callings don't wait for
    // the next poll.
    const snap = snapshotRef.current;
    if (snap) {
      snapshotRef.current = { ...snap, progressMs: target, fetchedAt: Date.now() };
    }
    setPositionMs(target);
  }, [tracks]);

  const skipGap = useCallback(() => {
    if (phaseRef.current === 'gap' || phaseRef.current === 'held') {
      void playIndex(indexRef.current + 1);
    }
  }, [playIndex]);

  const extendGap = useCallback((seconds: number) => {
    if (phaseRef.current !== 'gap') return;
    gapDeadlineRef.current += seconds * 1000;
    setGapRemaining(Math.max(0, Math.ceil((gapDeadlineRef.current - Date.now()) / 1000)));
  }, []);

  const holdNow = useCallback(() => {
    // The easy "pause permanently between tracks" button.
    const p = phaseRef.current;
    if (p === 'gap' || p === 'playing' || p === 'paused') {
      if (p !== 'gap') apiPause(deviceIdRef.current ?? undefined).catch(() => {});
      setPhase('held');
      phaseRef.current = 'held';
    }
  }, []);

  const setAutoContinue = useCallback((v: boolean) => {
    setAutoContinueState(v);
    autoRef.current = v;
  }, []);

  const recover = useCallback(() => {
    void (async () => {
      try {
        const devices = await getDevices();
        const target = devices.find((d) => d.is_active) ?? devices[0];
        if (!target) return; // none available — keep showing the lost banner
        deviceIdRef.current = target.id;
        setDeviceName(target.name);
        const pos = snapshotRef.current ? interpolatePosition(snapshotRef.current) : 0;
        await playTrack(
          tracks[indexRef.current].spotifyUri,
          target.id,
          Math.max(0, Math.round(pos)),
        );
        nullPollsRef.current = 0;
        wrongTrackPollsRef.current = 0;
        setNoDevice(false);
        setHijacked(false);
        setError(null);
        setPhase('playing');
        phaseRef.current = 'playing';
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [tracks]);

  return {
    index,
    track,
    phase,
    positionMs,
    durationMs,
    gapRemaining,
    autoContinue,
    deviceName,
    noDevice,
    hijacked,
    error,
    start,
    togglePlayPause,
    next,
    prev,
    seekTo,
    skipGap,
    extendGap,
    holdNow,
    setAutoContinue,
    attach,
    select,
    recover,
  };
}
