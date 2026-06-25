import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { getDevices, playTrack, transferPlayback } from '../spotify/api';
import { isLikelyLocalDevice } from '../spotify/localDevice';
import {
  loadKeepAwakeMethod,
  loadKeepAwakeOverride,
  loadSilentTrackUri,
  saveKeepAwakeMethod,
  type KeepAwakeMethod,
} from '../data/keepAwakeSetting';
import { readFlag, writeFlag } from '../data/storage';
import { toast } from '../data/toast';
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

// One-time "a silent track is playing" notice. The silent keep-awake method
// makes Spotify show "Silence …" as now-playing, which is confusing without
// context — so the first time it ever fires we explain it (and where to turn it
// off). Module-level + a persisted flag so it's once per browser, not per mount.
const SILENT_NOTICE_KEY = 'tjf.silentNoticeShown';
let silentNoticeShown = false;
function notifySilentOnce(deviceName: string | null): void {
  if (silentNoticeShown || readFlag(SILENT_NOTICE_KEY)) return;
  silentNoticeShown = true;
  writeFlag(SILENT_NOTICE_KEY, true);
  toast(
    `Keep-awake is playing a silent track on ${deviceName ?? 'the device'} so it stays ` +
      'ready between songs — Spotify shows it as “now playing”. Turn it off any time in Settings.',
  );
}

export interface KeepAwake {
  /** Effective on/off (override, else the local-device heuristic default). */
  keepAwake: boolean;
  /** True when keep-awake is on but the device wasn't found on the last check (asleep/offline). */
  asleep: boolean;
  /** The active keep-awake method ('ping' = no audio, 'silent' = plays a silent track). */
  method: KeepAwakeMethod;
  /** Switch the method live (persists + takes effect this session, no remount). */
  setMethod: (m: KeepAwakeMethod) => void;
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
  /** The explicitly-selected device id, used to keep it warm before first play. */
  deviceIdRef: MutableRefObject<string | null>;
}): KeepAwake {
  const { phaseRef, hijackedRef, deviceNameRef, deviceIdRef } = refs;
  // The coach's override (set in Settings, persisted), or null to follow the
  // local-device heuristic. Read once at mount; Settings lives in the list view,
  // so it's never changed while this hook (the player) is mounted.
  const overrideRef = useRef<boolean | null>(loadKeepAwakeOverride());
  // Keep-awake method (held in state so the player can flip it live — e.g. the
  // "stop the silent track" link in the held overlay — and the UI reacts). The
  // silent-track URI is read once at mount (it isn't toggled from the player).
  const [method, setMethodState, methodRef] = useStateRef<KeepAwakeMethod>(loadKeepAwakeMethod());
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
    const phase = phaseRef.current;
    const betweenTracks = phase === 'gap' || phase === 'held' || phase === 'ended';
    // On/off: 'paused' + between-tracks respect the learned local-device
    // heuristic (keepAwakeRef, set from the poller). Pre-play 'idle' (a deep-
    // linked detail page, before Play) has no learned device, so it follows an
    // explicit override and otherwise defaults on — the coach is on a specific
    // track with a selected device, so keep it warm.
    const on = phase === 'idle' ? overrideRef.current !== false : keepAwakeRef.current;
    if (!on) return;
    try {
      const devices = await getDevices();
      // Target the device we last played on (by name — ids churn on wake), else
      // the explicitly-selected device (before we've played and learned a name).
      const target =
        (deviceNameRef.current
          ? devices.find((d) => d.name === deviceNameRef.current)
          : null) ??
        (deviceIdRef.current ? devices.find((d) => d.id === deviceIdRef.current) : null);
      if (!target) {
        setAsleep(true);
        return;
      }
      // 'silent' mode plays a silent track to hold the device (and a Bluetooth
      // speaker) alive — but only between tracks. On a mid-track pause or pre-
      // play idle we must not start a track (it would lose the resume position /
      // start audio unprompted), so there we fall back to the no-audio ping.
      if (methodRef.current === 'silent' && betweenTracks && silentUriRef.current) {
        await playTrack(silentUriRef.current, target.id);
        notifySilentOnce(target.name);
      } else {
        await transferPlayback(target.id, false);
      }
      setAsleep(false);
    } catch {
      setAsleep(true);
    }
  }, [deviceNameRef, deviceIdRef, keepAwakeRef, methodRef, overrideRef, phaseRef, silentUriRef]);

  // Switch the method live (the held overlay's "stop the silent track"). Leaving
  // 'silent' re-asserts the device now (play:false) so a silent track playing
  // between tracks pauses immediately, rather than only on the next 15s tick.
  const setMethod = useCallback(
    (m: KeepAwakeMethod) => {
      saveKeepAwakeMethod(m);
      setMethodState(m);
      if (m !== 'silent') void keepAliveOnce();
    },
    [setMethodState, keepAliveOnce],
  );

  useEffect(() => {
    const id = setInterval(() => {
      const p = phaseRef.current;
      // Fire whenever we're not actively driving playback: between/after tracks,
      // a mid-track pause, AND pre-play 'idle' (a detail page before Play).
      // 'loading' is excluded — a transfer there would cancel the play we just
      // sent.
      const idle =
        p === 'idle' || p === 'paused' || p === 'gap' || p === 'held' || p === 'ended';
      if (!idle || hijackedRef.current) return;
      void keepAliveOnce();
    }, KEEP_AWAKE_MS);
    return () => clearInterval(id);
  }, [phaseRef, hijackedRef, keepAliveOnce]);

  const recheck = useCallback(() => void keepAliveOnce(), [keepAliveOnce]);

  return { keepAwake, asleep, method, setMethod, recheck, syncDefault };
}
