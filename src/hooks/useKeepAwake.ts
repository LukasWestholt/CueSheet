import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { getDevices, transferPlayback } from '../spotify/api';
import { isLikelyLocalDevice } from '../spotify/localDevice';
import { loadKeepAwakeOverride } from '../data/keepAwakeSetting';
import { useStateRef } from './useStateRef';
import type { Phase } from './usePlayerEngine';

// Keep-awake: while we're paused between tracks, Spotify eventually marks the
// Connect device "inactive" and drops it. To prevent that we periodically
// re-assert it (transferPlayback, play:false → no audio). The setting lives in
// keepAwakeSetting.ts (a Settings toggle is the only writer): it defaults to
// following isLikelyLocalDevice (a user-agent → device-name heuristic) — on for
// our own device, off otherwise — unless the coach has set an explicit on/off
// (e.g. to rescue a privacy-frozen Android UA), which wins.
const KEEP_AWAKE_MS = 15000;

export interface KeepAwake {
  /** Effective on/off (override, else the local-device heuristic default). */
  keepAwake: boolean;
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
  const [keepAwake, setKeepAwakeState, keepAwakeRef] = useStateRef<boolean>(
    overrideRef.current ?? false,
  );

  const syncDefault = useCallback(
    (deviceName: string | null, deviceType: string | null) => {
      const effective =
        overrideRef.current ?? isLikelyLocalDevice(deviceName, deviceType, navigator.userAgent);
      if (effective !== keepAwakeRef.current) setKeepAwakeState(effective);
    },
    [keepAwakeRef, setKeepAwakeState],
  );

  useEffect(() => {
    const id = setInterval(() => {
      const p = phaseRef.current;
      const idle = p === 'paused' || p === 'gap' || p === 'held' || p === 'ended';
      const target = deviceNameRef.current;
      if (!idle || hijackedRef.current || !keepAwakeRef.current || !target) return;
      void (async () => {
        try {
          const match = (await getDevices()).find((d) => d.name === target);
          if (match) await transferPlayback(match.id, false);
        } catch {
          /* device unreachable — the no-device recovery banner handles that */
        }
      })();
    }, KEEP_AWAKE_MS);
    return () => clearInterval(id);
  }, [phaseRef, hijackedRef, keepAwakeRef, deviceNameRef]);

  return { keepAwake, syncDefault };
}
