// The vibrate-on-step-change setting, shared by the player's toggle and the
// list-view Settings panel. Opt-in: off until the coach enables it. Only
// meaningful where the Vibration API exists (Android — iOS Safari lacks it),
// so callers hide their toggle behind `hapticSupported()`.
import { readString, writeString } from './storage';

const KEY = 'tjf.haptic';

export function loadHaptic(): boolean {
  return readString(KEY, '0') === '1';
}

export function saveHaptic(value: boolean): void {
  writeString(KEY, value ? '1' : '0');
}

/** Whether this device can vibrate at all (feature-gates the toggles). */
export function hapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}
