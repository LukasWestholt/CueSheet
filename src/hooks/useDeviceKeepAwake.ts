import { useEffect } from 'react';
import { getDevices, transferPlayback } from '../spotify/api';
import { isLikelyLocalDevice } from '../spotify/localDevice';
import { loadKeepAwake } from '../data/keepAwakeSetting';

const KEEP_AWAKE_MS = 15000;

/**
 * App-level keep-awake for the screens where the player engine ISN'T mounted
 * (the list, editor, seed). The engine's own keep-awake only runs once a track
 * has played, so a Connect device can drop off — or never wake — while the coach
 * is still browsing, building a setlist, or sitting on a deep-linked detail page
 * before pressing Play. This re-asserts the device (no audio: `transferPlayback`
 * play:false) every 15s so it's ready the instant Play is pressed.
 *
 * Yields entirely while `active` is false — the player view owns the device then
 * (its `useKeepAwake` handles playing + between-tracks + the pre-play idle), so
 * the two loops never both touch the device. Targets the explicitly-selected
 * device, else the active one, else a heuristically-local one (our own machine).
 */
export function useDeviceKeepAwake(selectedDeviceId: string | null, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const ping = async () => {
      // Re-read the setting each tick so toggling it in Settings (which lives on
      // an active screen here) takes effect within a cycle, no remount needed.
      if (!loadKeepAwake()) return;
      try {
        const devices = await getDevices();
        if (cancelled || devices.length === 0) return;
        const target =
          (selectedDeviceId && devices.find((d) => d.id === selectedDeviceId)) ||
          devices.find((d) => d.is_active) ||
          devices.find((d) => isLikelyLocalDevice(d.name, d.type, navigator.userAgent)) ||
          null;
        if (target && !cancelled) await transferPlayback(target.id, false);
      } catch {
        /* device unreachable / offline — nothing to keep awake this tick */
      }
    };
    const id = setInterval(ping, KEEP_AWAKE_MS);
    ping();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedDeviceId, active]);
}
