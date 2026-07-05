import { useEffect } from 'react';
import { getDevices, getPlaybackState, playTrack, transferPlayback } from '../spotify/api';
import { loadKeepAwake, loadKeepAwakeMethod, loadSilentTrackUri } from '../data/keepAwakeSetting';
import { notifySilentOnce } from './useKeepAwake';

const KEEP_AWAKE_MS = 15000;

/**
 * App-level keep-awake for the screens where the player engine ISN'T mounted
 * (the list, editor, seed). The engine's own keep-awake only runs once the
 * player is open, so a Connect device can drop off — or never wake — while the
 * coach is still browsing or building a setlist. Every 15s (plus immediately on
 * activation) it re-asserts the device: the no-audio `transferPlayback`
 * play:false ping, or — when the **'silent' method** is on — the silent track,
 * which also keeps a Bluetooth speaker connected (a mere ping doesn't; the
 * speaker drops within seconds of real silence). Method/URI are re-read each
 * tick, like the on/off flag, since Settings lives on these screens.
 *
 * It targets ONLY the device the coach has **explicitly selected** in the picker
 * (`selectedDeviceId`) — no active-device / local-machine guessing here, since
 * keeping a device awake means seizing it on Connect, and we don't want to grab
 * one the coach didn't choose. No selection → it does nothing.
 *
 * Crucially it **never touches a device that's already playing**: a transfer
 * with play:false would PAUSE the current track, and re-playing the silent
 * track would restart it. If Spotify reports playback is live (real music the
 * coach left running, or the silent track already holding the device), the
 * tick is skipped — a playing device is already awake.
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
        // Never pause a live track: a transfer with play:false would stop it.
        // If anything is playing, the device is already awake — leave it be.
        const snap = await getPlaybackState();
        if (cancelled || snap?.isPlaying) return;
        const devices = await getDevices();
        if (cancelled) return;
        // Only the explicitly-selected device — and only while it's actually
        // present on Connect (don't transfer to a stale/gone id).
        const target = devices.find((d) => d.id === selectedDeviceId);
        if (!target || cancelled) return;
        const silentUri = loadKeepAwakeMethod() === 'silent' ? loadSilentTrackUri() : null;
        if (silentUri) {
          await playTrack(silentUri, target.id);
          notifySilentOnce(target.name);
        } else {
          await transferPlayback(target.id, false);
        }
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
