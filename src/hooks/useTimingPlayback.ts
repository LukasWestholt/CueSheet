import { useCallback, useEffect, useRef, useState } from 'react';
import { getPlaybackState, pause, playTrack, type PlaybackSnapshot } from '../spotify/api';
import { interpolatePosition } from '../playback/position';
import { useSyncOffset } from './useSyncOffset';

const POLL_MS = 1000;
const TICK_MS = 100;

/**
 * Minimal playback control for the editor's timing flow — NOT the player
 * engine. It only needs to (re)start the draft's track from 0 on the selected
 * Connect device and expose a live interpolated position to tap against:
 * a 1s poll for the authoritative position plus a 100ms interpolation tick,
 * shifted by the persisted sync offset so taps line up with what the coach
 * hears (Bluetooth latency), exactly like the player's tap position did.
 * No phases, no end detection, no keep-awake — the editor doesn't need them.
 */
export function useTimingPlayback(spotifyUri: string, deviceId: string | null) {
  const [playing, setPlaying] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const snapRef = useRef<PlaybackSnapshot | null>(null);
  const startedRef = useRef(false); // we started playback (so stop() may pause)
  // The player's persisted sync slider value — taps line up with what's heard.
  const [offsetMs] = useSyncOffset();
  const offsetMsRef = useRef(offsetMs);
  offsetMsRef.current = offsetMs;

  /** (Re)starts the track from the top on the selected device. */
  const start = useCallback(async () => {
    setError(null);
    try {
      await playTrack(spotifyUri, deviceId ?? undefined, 0);
      startedRef.current = true;
      // Synthetic snapshot until the first poll lands, so ticking starts now.
      snapRef.current = {
        isPlaying: true,
        progressMs: 0,
        durationMs: 0,
        trackUri: spotifyUri,
        deviceId,
        deviceName: null,
        deviceType: null,
        volumePercent: null,
        supportsVolume: false,
        fetchedAt: Date.now(),
      };
      setPlaying(true);
      setPositionSeconds(Math.max(0, offsetMsRef.current) / 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [spotifyUri, deviceId]);

  /** Best-effort pause; only touches the device if we started playback. */
  const stop = useCallback(() => {
    if (!startedRef.current) return;
    startedRef.current = false;
    snapRef.current = null;
    setPlaying(false);
    pause(deviceId ?? undefined).catch(() => {});
  }, [deviceId]);

  // Poll + tick while we own playback. Snapshots for a different track (the
  // coach grabbed the device with another app) are ignored rather than adopted.
  useEffect(() => {
    if (!playing) return;
    const poll = setInterval(() => {
      getPlaybackState()
        .then((snap) => {
          if (!snap || snap.trackUri !== spotifyUri) return;
          snapRef.current = snap;
          if (!snap.isPlaying) setPlaying(false);
        })
        .catch(() => {});
    }, POLL_MS);
    const tick = setInterval(() => {
      const snap = snapRef.current;
      if (!snap) return;
      const ms = interpolatePosition(snap) + offsetMsRef.current;
      setPositionSeconds(Math.max(0, ms) / 1000);
    }, TICK_MS);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [playing, spotifyUri]);

  // Leaving the editor mid-flow shouldn't leave the track playing.
  useEffect(() => stop, [stop]);

  return { positionSeconds, playing, error, start, stop };
}
