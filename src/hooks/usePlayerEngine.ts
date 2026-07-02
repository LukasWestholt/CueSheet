import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '../data/tracks';
import { useStateRef } from './useStateRef';
import { useKeepAwake } from './useKeepAwake';
import type { KeepAwakeMethod } from '../data/keepAwakeSetting';
import { interpolatePosition } from '../playback/position';
import { toast } from '../data/toast';
import {
  getDevices,
  getPlaybackState,
  pause as apiPause,
  playTrack,
  resume as apiResume,
  seek as apiSeek,
  setVolume as apiSetVolume,
  type PlaybackSnapshot,
} from '../spotify/api';

export type Phase =
  | 'idle' // nothing started yet
  | 'loading' // sent play command, waiting for first state
  | 'playing'
  | 'paused' // paused mid-track by the user
  | 'gap' // inter-track countdown (gapSeconds, default 10s)
  | 'held' // permanently paused between tracks (auto-continue cancelled)
  | 'ended'; // last track finished, nothing queued

const POLL_MS = 1000; // how often we ask Spotify for the true position
const TICK_MS = 100; // how often we re-render the interpolated position
const END_GUARD_MS = 500; // treat as ended this close to the track's end
const NO_DEVICE_NULLS = 2; // consecutive empty polls before declaring the device lost
const HIJACK_POLLS = 3; // consecutive wrong-track polls before declaring a hijack
const END_AUTOPLAY_WINDOW_MS = 1500; // a track change/restart this close to the end = the track ending, not a hijack
const LOOP_RESTART_MS = 2000; // same track back within this of the start (after being near the end) = a repeat=track loop
// On entering an idle/between-tracks phase, kick the keep-alive once after this
// short settle (instead of waiting up to a full KEEP_AWAKE_MS tick), so the
// silent track / ping starts promptly. The delay lets enterGapOrEnd's
// fire-and-forget pause land first, so it can't race ahead and pause a silent
// track we're about to start.
const KEEP_AWAKE_KICKOFF_MS = 1000;

/** Default inter-track gap (seconds). Exported so session estimates stay in sync. */
export const DEFAULT_GAP_SECONDS = 10;
const PREV_TRACK_WINDOW_MS = 3000; // a 2nd "prev" within this jumps to the previous track

/** Toast when a fire-and-forget playback command (pause/resume/seek) fails. */
const controlFailed = (what: string) => () =>
  toast(`Couldn’t ${what} on Spotify — check the player device.`);

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
  /** Active device volume 0–100, or null when unknown / not yet polled. */
  volumePercent: number | null;
  /** Whether the keep-awake ping is on (defaults to the local-device heuristic). */
  keepAwake: boolean;
  /** The active keep-awake method ('ping' = no audio, 'silent' = plays a silent track). */
  keepAwakeMethod: KeepAwakeMethod;
  /** Switch the keep-awake method live (e.g. stop the silent track from the overlay). */
  setKeepAwakeMethod: (m: KeepAwakeMethod) => void;
  /** While keep-awake is on: the device wasn't found on the last check (asleep/offline). */
  deviceAsleep: boolean;
  /**
   * Re-check the keep-awake device list now and re-assert it if it's back —
   * WITHOUT resuming playback (we're paused between tracks). Contrast `recover`,
   * which re-acquires a device and *replays* the current track.
   */
  recheckDevice: () => void;
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
  /** Set the active device's volume (0–100); optimistic + debounced. */
  setVolume: (percent: number) => void;
  skipGap: () => void;
  /** Add seconds to the running inter-track gap countdown. */
  extendGap: (seconds: number) => void;
  holdNow: () => void; // the "pause permanently between tracks" button
  setAutoContinue: (v: boolean) => void;
  /** Re-acquire a playback device and *resume* the current track (replays it). */
  recover: () => void;
}

export function usePlayerEngine(
  tracks: Track[],
  deviceId: string | null,
  gapSeconds = DEFAULT_GAP_SECONDS,
): PlayerEngine {
  // State paired with a ref the timers/poller read for fresh values without
  // being torn down (useStateRef keeps the two in sync — set once, both update).
  const [index, setIndex, indexRef] = useStateRef(0);
  const [phase, setPhase, phaseRef] = useStateRef<Phase>('idle');
  const [autoContinue, setAutoContinue, autoRef] = useStateRef(true);
  const [noDevice, setNoDevice, noDeviceRef] = useStateRef(false);
  const [hijacked, setHijacked, hijackedRef] = useStateRef(false);

  // Plain state (no ref needed — only read during render).
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [gapRemaining, setGapRemaining] = useState(gapSeconds);
  // deviceName has a ref so the keep-awake loop can read the device we last
  // played on (its ping target, re-resolved by name since Spotify reassigns ids).
  const [deviceName, setDeviceName, deviceNameRef] = useStateRef<string | null>(null);
  const [volumePercent, setVolumePercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pure refs (mutable values that never drive a render).
  const snapshotRef = useRef<PlaybackSnapshot | null>(null);
  const gapDeadlineRef = useRef(0);
  const deviceIdRef = useRef(deviceId);
  const lastPrevAtRef = useRef(0);
  const nullPollsRef = useRef(0);
  const wrongTrackPollsRef = useRef(0);
  // Lets the poller call recover() (defined below) without re-subscribing, with
  // a debounce so the 1s poll doesn't fire repeated reconnects while one is in
  // flight (recover() clears noDevice only once it has resumed playback).
  const recoverRef = useRef<() => void>(() => {});
  const lastRecoverAtRef = useRef(0);
  // Volume: debounce the API write while dragging, and ignore poll readings for
  // a moment after a user change so a stale snapshot doesn't snap the slider back.
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVolumeSetAtRef = useRef(0);

  deviceIdRef.current = deviceId;

  // Keep-awake setting + ping loop (its own focused hook).
  const {
    keepAwake,
    asleep: deviceAsleep,
    method: keepAwakeMethod,
    setMethod: setKeepAwakeMethod,
    recheck: recheckDevice,
    syncDefault: syncKeepAwakeDefault,
  } = useKeepAwake({ phaseRef, hijackedRef, deviceNameRef, deviceIdRef });

  const track = tracks[index];

  const playIndex = useCallback(
    async (i: number, positionMs = 0) => {
      const t = tracks[i];
      if (!t) return;
      setIndex(i);
      setPhase('loading');
      setPositionMs(positionMs);
      snapshotRef.current = null;
      setError(null);
      try {
        await playTrack(t.spotifyUri, deviceIdRef.current ?? undefined, positionMs);
        setPhase('playing');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('paused');
      }
    },
    [tracks, setIndex, setPhase],
  );

  const enterGapOrEnd = useCallback((reason = 'unknown') => {
    // DIAGNOSTIC: capture why/when the track was treated as ended, to chase the
    // "stops 4-5s too early" report. Shows whether pos overshot, the poll was
    // stale, or the duration was off. Remove once the root cause is found.
    const snap = snapshotRef.current;
    console.debug('[player] enterGapOrEnd', {
      reason,
      index: indexRef.current,
      pos: snap ? Math.round(interpolatePosition(snap)) : null,
      progressMs: snap?.progressMs ?? null,
      durationMs: snap?.durationMs ?? null,
      authoredDurationMs: tracks[indexRef.current]?.durationMs ?? null,
      pollAgeMs: snap ? Date.now() - snap.fetchedAt : null,
      isPlaying: snap?.isPlaying ?? null,
    });
    // Stop the finished track ourselves, otherwise Spotify may loop it (repeat)
    // or roll into autoplay during the gap / after the routine ends.
    apiPause(deviceIdRef.current ?? undefined).catch(() => {});
    const hasNext = indexRef.current + 1 < tracks.length;
    if (!hasNext) {
      setPhase('ended');
      return;
    }
    if (autoRef.current) {
      gapDeadlineRef.current = Date.now() + gapSeconds * 1000;
      setGapRemaining(gapSeconds);
      setPhase('gap');
    } else {
      setPhase('held');
    }
  }, [tracks, gapSeconds, setPhase, indexRef, autoRef]);

  // Poll Spotify for the authoritative playback state.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const active = ['playing', 'paused'].includes(phaseRef.current);
      if (!active) return;
      // Device already lost: stop hitting /me/player (it just 204s) and watch
      // the cheaper /devices list instead. When a device comes back, reconnect
      // (debounced — recover() only clears noDevice once playback resumes).
      if (noDeviceRef.current) {
        try {
          const back = (await getDevices()).length > 0;
          if (back && !cancelled && Date.now() - lastRecoverAtRef.current > 5000) {
            lastRecoverAtRef.current = Date.now();
            recoverRef.current();
          }
        } catch {
          /* still unreachable — keep waiting */
        }
        return;
      }
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

        // Were we near our track's end on the last good snapshot? Both the
        // auto-advance and loop guards below key off this: a track change or a
        // restart this close to the end is the track *ending*, not a hijack.
        const expectedUri = tracks[indexRef.current]?.spotifyUri;
        const last = snapshotRef.current;
        const wasNearEnd =
          phaseRef.current === 'playing' &&
          last != null &&
          last.durationMs > 0 &&
          interpolatePosition(last) >= last.durationMs - END_AUTOPLAY_WINDOW_MS;

        // Hijack guard: while we expect our track to be playing, Spotify reports a
        // *different* track — another app/user grabbed this Connect device. Confirm
        // across a few polls so the brief lag during our own track change isn't
        // mistaken for one.
        if (
          phaseRef.current === 'playing' &&
          snap.trackUri &&
          expectedUri &&
          snap.trackUri !== expectedUri
        ) {
          // A different track while we were near the end = Spotify auto-advancing
          // at the track's end (we lost the ~500ms pre-empt race), not a hijack.
          // Treat it as the normal end: enterGapOrEnd() pauses the autoplayed
          // track and runs our gap / ends the routine.
          if (wasNearEnd) {
            wrongTrackPollsRef.current = 0;
            enterGapOrEnd('poller:autoplay-different-track');
            return;
          }
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

        // Loop guard: the *same* track jumped back to the top while we were near
        // the end = the device has repeat=track on and looped it (we lost the
        // pre-empt race). Treat it as the normal end rather than replaying.
        if (wasNearEnd && snap.progressMs < LOOP_RESTART_MS) {
          enterGapOrEnd('poller:loop-restart');
          return;
        }

        snapshotRef.current = snap;
        setDeviceName(snap.deviceName);
        // Don't clobber a volume the coach just dragged with a stale reading.
        if (Date.now() - lastVolumeSetAtRef.current > 1500) {
          setVolumePercent(snap.volumePercent);
        }
        syncKeepAwakeDefault(snap.deviceName, snap.deviceType);
        // If Spotify reports it stopped near the end, the track finished.
        if (
          phaseRef.current === 'playing' &&
          !snap.isPlaying &&
          snap.durationMs > 0 &&
          snap.progressMs >= snap.durationMs - 2000
        ) {
          enterGapOrEnd('poller:stopped-near-end');
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
  }, [enterGapOrEnd, tracks, setNoDevice, setHijacked, syncKeepAwakeDefault, phaseRef, indexRef, noDeviceRef, hijackedRef]);

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
            enterGapOrEnd('ticker:interpolated-end');
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
  }, [enterGapOrEnd, playIndex, tracks, phaseRef, indexRef, noDeviceRef, hijackedRef]);

  // Kick the keep-alive once right after we enter an idle/between-tracks phase,
  // so the silent track / device ping starts within ~1s of a track ending (or of
  // opening a detail view) instead of waiting up to a full KEEP_AWAKE_MS tick.
  // The steady-state interval (inside useKeepAwake) is unchanged.
  useEffect(() => {
    const idle =
      phase === 'idle' ||
      phase === 'paused' ||
      phase === 'gap' ||
      phase === 'held' ||
      phase === 'ended';
    if (!idle || hijacked) return;
    const t = setTimeout(() => recheckDevice(), KEEP_AWAKE_KICKOFF_MS);
    return () => clearTimeout(t);
  }, [phase, hijacked, recheckDevice]);

  // ---- Controls ----------------------------------------------------------
  const start = useCallback((i: number) => void playIndex(i), [playIndex]);

  const attach = useCallback((i: number) => {
    // Re-attach to a track already playing on Spotify (e.g. after a page
    // reload) without sending a play command — the poller syncs the position.
    setIndex(i);
    setError(null);
    setPhase('playing');
  }, [setIndex, setPhase]);

  const select = useCallback((i: number) => {
    // Point the engine at a track without playing it: idle keeps both timers
    // inactive, so a deep-linked detail page shows the routine quietly until the
    // user presses Play.
    setIndex(i);
    setError(null);
    setPhase('idle');
  }, [setIndex, setPhase]);

  const togglePlayPause = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'playing') {
      apiPause(deviceIdRef.current ?? undefined).catch(controlFailed('pause'));
      // Freeze position at the last known value.
      const snap = snapshotRef.current;
      if (snap) {
        snapshotRef.current = { ...snap, isPlaying: false, fetchedAt: Date.now() };
      }
      setPhase('paused');
    } else if (p === 'paused') {
      apiResume(deviceIdRef.current ?? undefined).catch(controlFailed('resume'));
      const snap = snapshotRef.current;
      if (snap) {
        snapshotRef.current = { ...snap, isPlaying: true, fetchedAt: Date.now() };
      }
      setPhase('playing');
    } else if (p === 'held' || p === 'gap' || p === 'ended') {
      // Resume the routine from where we paused between tracks.
      void playIndex(indexRef.current + (p === 'ended' ? 0 : 1));
    }
  }, [playIndex, setPhase, phaseRef, indexRef]);

  const next = useCallback(() => {
    const i = Math.min(tracks.length - 1, indexRef.current + 1);
    void playIndex(i);
  }, [playIndex, tracks.length, indexRef]);

  const prev = useCallback(() => {
    // First press restarts the current track; a quick second press (within
    // PREV_TRACK_WINDOW_MS) jumps to the previous track instead.
    const now = Date.now();
    const goPrevious = now - lastPrevAtRef.current < PREV_TRACK_WINDOW_MS && indexRef.current > 0;
    lastPrevAtRef.current = now;
    void playIndex(goPrevious ? indexRef.current - 1 : indexRef.current);
  }, [playIndex, indexRef]);

  const seekTo = useCallback((rawPositionMs: number) => {
    const p = phaseRef.current;
    if (p === 'gap' || p === 'held' || p === 'ended') {
      // Between tracks the displayed track isn't playing any more (a silent
      // keep-awake track may even be) — a raw seek would target the wrong
      // playback. Restart the displayed track at the tapped position instead,
      // so "start from the chorus" works from a hold.
      void playIndex(indexRef.current, Math.max(0, rawPositionMs));
      return;
    }
    if (p !== 'playing' && p !== 'paused') return;
    const duration =
      snapshotRef.current?.durationMs || tracks[indexRef.current]?.durationMs || 0;
    const target = Math.max(0, duration > 0 ? Math.min(rawPositionMs, duration) : rawPositionMs);
    apiSeek(target, deviceIdRef.current ?? undefined).catch(controlFailed('seek'));
    // Reflect the new position immediately so display + callings don't wait for
    // the next poll.
    const snap = snapshotRef.current;
    if (snap) {
      snapshotRef.current = { ...snap, progressMs: target, fetchedAt: Date.now() };
    }
    setPositionMs(target);
  }, [tracks, playIndex, phaseRef, indexRef]);

  const setVolume = useCallback((percent: number) => {
    const v = Math.max(0, Math.min(100, Math.round(percent)));
    lastVolumeSetAtRef.current = Date.now();
    setVolumePercent(v); // optimistic — reflect the drag immediately
    const snap = snapshotRef.current;
    if (snap) snapshotRef.current = { ...snap, volumePercent: v };
    // Debounce the PUT so dragging the slider doesn't fire a request per tick.
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => {
      apiSetVolume(v, deviceIdRef.current ?? undefined).catch(controlFailed('set volume'));
    }, 200);
  }, []);
  useEffect(() => () => {
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
  }, []);

  const skipGap = useCallback(() => {
    if (phaseRef.current === 'gap' || phaseRef.current === 'held') {
      void playIndex(indexRef.current + 1);
    }
  }, [playIndex, phaseRef, indexRef]);

  const extendGap = useCallback((seconds: number) => {
    if (phaseRef.current !== 'gap') return;
    gapDeadlineRef.current += seconds * 1000;
    setGapRemaining(Math.max(0, Math.ceil((gapDeadlineRef.current - Date.now()) / 1000)));
  }, [phaseRef]);

  const holdNow = useCallback(() => {
    // The easy "pause permanently between tracks" button.
    const p = phaseRef.current;
    if (p === 'gap' || p === 'playing' || p === 'paused') {
      if (p !== 'gap') apiPause(deviceIdRef.current ?? undefined).catch(controlFailed('pause'));
      setPhase('held');
    }
  }, [setPhase, phaseRef]);

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
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [tracks, setNoDevice, setHijacked, setPhase, indexRef]);
  recoverRef.current = recover; // so the poller can auto-reconnect when the device returns

  return {
    index,
    track,
    phase,
    positionMs,
    durationMs,
    gapRemaining,
    autoContinue,
    deviceName,
    volumePercent,
    keepAwake,
    keepAwakeMethod,
    setKeepAwakeMethod,
    deviceAsleep,
    recheckDevice,
    noDevice,
    hijacked,
    error,
    start,
    togglePlayPause,
    next,
    prev,
    seekTo,
    setVolume,
    skipGap,
    extendGap,
    holdNow,
    setAutoContinue,
    attach,
    select,
    recover,
  };
}
