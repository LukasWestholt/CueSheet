import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { getDevices, playTrack, transferPlayback } from '../spotify/api';
import { isLikelyLocalDevice } from '../spotify/localDevice';
import {
  loadKeepAwakeMethod,
  loadKeepAwakeOverride,
  loadSilentTrackUri,
} from '../data/keepAwakeSetting';
import { useStateRef } from './useStateRef';
import type { Phase } from './usePlayerEngine';

// Keep-awake: while we're paused between tracks, Spotify eventually marks the
// Connect device "inactive" and drops it. To prevent that we periodically
// re-assert it. Two methods (keepAwakeSetting.ts, set in Settings): the default
// 'ping' re-asserts with transferPlayback (play:false → no audio); 'silent'
// instead plays a silent track between tracks, which also keeps a Bluetooth
// speaker connected (it drops after a pause). On/off defaults to following
// isLikelyLocalDevice (a user-agent → device-name heuristic) — on for our own
// device, off otherwise — unless the coach has set an explicit on/off (e.g. to
// rescue a privacy-frozen Android UA), which wins.
const KEEP_AWAKE_MS = 15000;

export interface KeepAwake {
  /** Effective on/off (override, else the local-device heuristic default). */
  keepAwake: boolean;
  /** True when keep-awake is on but the device wasn't found on the last check (asleep/offline). */
  asleep: boolean;
  /** Re-check the device list now (and re-assert it if it's back). For a manual "Check again". */
  recheck: () => void;
  /** Recompute the heuristic default from the currently active device. */
  syncDefault: (deviceName: string | null, deviceType: string | null) => void;
}

/**
 * Owns the keep-awake setting and its ping loop. The caller passes the engine's
 * refs so the ping only fires while idle (between tracks), not hijacked, and
 * targets the device we last played on (`deviceNameRef`) — looked up fresh in
 * getDevices each tick since Spotify reassigns device ids on wake.
 */
export function useKeepAwake(refs: {
  phaseRef: MutableRefObject<Phase>;
  hijackedRef: MutableRefObject<boolean>;
  deviceNameRef: MutableRefObject<string | null>;
}): KeepAwake {
  const { phaseRef, hijackedRef, deviceNameRef } = refs;
  // The coach's override (set in Settings, persisted), or null to follow the
  // local-device heuristic. Read once at mount; Settings lives in the list view,
  // so it's never changed while this hook (the player) is mounted.
  const overrideRef = useRef<boolean | null>(loadKeepAwakeOverride());
  // Keep-awake method + silent-track URI, read once at mount like the override
  // (Settings lives in the list view, so they don't change while the player —
  // and this hook — is mounted).
  const methodRef = useRef(loadKeepAwakeMethod());
  const silentUriRef = useRef(loadSilentTrackUri());
  const [keepAwake, setKeepAwakeState, keepAwakeRef] = useStateRef<boolean>(
    overrideRef.current ?? false,
  );
  // True when the last keep-alive check couldn't find the device — it has gone
  // to sleep / dropped off Connect (only meaningful while keep-awake is on).
  const [asleep, setAsleep] = useState(false);

  const syncDefault = useCallback(
    (deviceName: string | null, deviceType: string | null) => {
      // A live snapshot means the device is awake again.
      setAsleep(false);
      const effective =
        overrideRef.current ?? isLikelyLocalDevice(deviceName, deviceType, navigator.userAgent);
      if (effective !== keepAwakeRef.current) setKeepAwakeState(effective);
    },
    [keepAwakeRef, setKeepAwakeState],
  );

  // Re-assert the device we last played on so Spotify keeps it active. Records
  // whether it was found (asleep = not found). Shared by the 15s loop and the
  // manual "Check again" button.
  const keepAliveOnce = useCallback(async () => {
    const target = deviceNameRef.current;
    if (!keepAwakeRef.current || !target) return;
    try {
      const match = (await getDevices()).find((d) => d.name === target);
      if (!match) {
        setAsleep(true);
        return;
      }
      // 'silent' mode plays a silent track to hold the device (and a Bluetooth
      // speaker) alive — but only between tracks. On a mid-track pause we must
      // not start another track (it would lose the resume position), so there we
      // fall back to the no-audio ping just like 'ping' mode.
      const betweenTracks =
        phaseRef.current === 'gap' || phaseRef.current === 'held' || phaseRef.current === 'ended';
      if (methodRef.current === 'silent' && betweenTracks && silentUriRef.current) {
        await playTrack(silentUriRef.current, match.id);
      } else {
        await transferPlayback(match.id, false);
      }
      setAsleep(false);
    } catch {
      setAsleep(true);
    }
  }, [deviceNameRef, keepAwakeRef, phaseRef]);

  useEffect(() => {
    const id = setInterval(() => {
      const p = phaseRef.current;
      const idle = p === 'paused' || p === 'gap' || p === 'held' || p === 'ended';
      if (!idle || hijackedRef.current) return;
      void keepAliveOnce();
    }, KEEP_AWAKE_MS);
    return () => clearInterval(id);
  }, [phaseRef, hijackedRef, keepAliveOnce]);

  const recheck = useCallback(() => void keepAliveOnce(), [keepAliveOnce]);

  return { keepAwake, asleep, recheck, syncDefault };
}
