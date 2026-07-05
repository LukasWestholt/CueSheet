// The keep-awake setting (see useKeepAwake): keep the playback device "active"
// between tracks so Spotify doesn't drop it. Modelled as two booleans rather
// than a tri-state, so the Settings UI can be a plain on/off toggle while still
// remembering whether the coach has overridden the automatic default:
//   manual=false → AUTO: follow the local-device heuristic (isLikelyLocalDevice)
//   manual=true  → use `value` (the explicit on/off the coach picked)
// Shared by the Settings panel (the writer) and the engine's useKeepAwake hook.

import { readFlag, writeFlag, readString, writeString } from './storage';

const VALUE_KEY = 'tjf.keepAwake';
const MANUAL_KEY = 'tjf.keepAwakeManual';
const METHOD_KEY = 'tjf.keepAwakeMethod';
const SILENT_URI_KEY = 'tjf.silentTrackUri';

/**
 * How keep-awake holds the Spotify client active while nothing plays. A client
 * that idles too long goes to sleep, and this app cannot wake it again — the
 * Web API only reaches a live client — so sleep must be prevented, not cured:
 *   'ping'   — a no-audio API ping (transferPlayback play:false). The default.
 *   'silent' — actually play a silent track on the device, for clients whose
 *              sleep is too strong for a mere ping (iPhones especially — only
 *              real playback keeps them awake), at the cost of "playing" an
 *              inaudible track. Runs on every idle, incl. a mid-track pause
 *              (resume re-plays the paused track at its frozen position).
 */
export type KeepAwakeMethod = 'ping' | 'silent';

/** Default silent track played in 'silent' mode: "Silence 10 Minutes" (10 min). */
export const DEFAULT_SILENT_TRACK_URI = 'spotify:track:3mkOlbSv5RYadx0JsjTrKq';

/** Has the coach explicitly chosen, overriding the automatic (heuristic) default? */
export function isKeepAwakeManual(): boolean {
  return readFlag(MANUAL_KEY);
}

/** The on/off value to show in Settings: the explicit choice, else the auto default (on). */
export function loadKeepAwake(): boolean {
  return isKeepAwakeManual() ? readFlag(VALUE_KEY) : true;
}

/** Persist an explicit on/off — this marks the setting as a manual override. */
export function saveKeepAwake(value: boolean): void {
  writeFlag(VALUE_KEY, value);
  writeFlag(MANUAL_KEY, true);
}

/** The explicit override for the engine, or null to follow the heuristic default. */
export function loadKeepAwakeOverride(): boolean | null {
  return isKeepAwakeManual() ? readFlag(VALUE_KEY) : null;
}

/** The keep-awake method (defaults to 'ping' — the original no-audio behaviour). */
export function loadKeepAwakeMethod(): KeepAwakeMethod {
  return readString(METHOD_KEY) === 'silent' ? 'silent' : 'ping';
}

/** Persist the keep-awake method. */
export function saveKeepAwakeMethod(method: KeepAwakeMethod): void {
  writeString(METHOD_KEY, method);
}

/** The track URI to play in 'silent' mode — an override, else the default silent track. */
export function loadSilentTrackUri(): string {
  return readString(SILENT_URI_KEY).trim() || DEFAULT_SILENT_TRACK_URI;
}

/** Persist a silent-track URI override (empty clears it → back to the default). */
export function saveSilentTrackUri(uri: string): void {
  writeString(SILENT_URI_KEY, uri.trim());
}
