import { useEffect } from 'react';
import { getDevices, transferPlayback } from '../spotify/api';
import { loadKeepAwake } from '../data/keepAwakeSetting';

const KEEP_AWAKE_MS = 15000;

/**
 * App-level keep-awake for the screens where the player engine ISN'T mounted
 * (the list, editor, seed). The engine's own keep-awake only runs once a track
 * has played, so a Connect device can drop off — or never wake — while the coach
 * is still browsing or building a setlist. This re-asserts the device (no audio:
 * `transferPlayback` play:false) every 15s so it's ready the instant Play is hit.
 *
 * It targets ONLY the device the coach has **explicitly selected** in the picker
 * (`selectedDeviceId`) — no active-device / local-machine guessing here, since
 * keeping a device awake means seizing it on Connect, and we don't want to grab
 * one the coach didn't choose. No selection → it does nothing.
 *
 * Yields entirely while `active` is false — the player view owns the device then
 * (its `useKeepAwake` handles playing + between-tracks + the pre-play idle), so
 * the two loops never both touch the device.
 */
export function useDeviceKeepAwake(selectedDeviceId: string | null, active: boolean): void {
  useEffect(() => {
    if (!active || !selectedDeviceId) return;
    let cancelled = false;
    const ping = async () => {
      // Re-read the setting each tick so toggling it in Settings (which lives on
      // an active screen here) takes effect within a cycle, no remount needed.
      if (!loadKeepAwake()) return;
      try {
        const devices = await getDevices();
        if (cancelled) return;
        // Only the explicitly-selected device — and only while it's actually
        // present on Connect (don't transfer to a stale/gone id).
        const target = devices.find((d) => d.id === selectedDeviceId);
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
