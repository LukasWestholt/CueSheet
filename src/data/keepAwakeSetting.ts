// The keep-awake setting (see useKeepAwake): keep the playback device "active"
// between tracks so Spotify doesn't drop it. Modelled as two booleans rather
// than a tri-state, so the Settings UI can be a plain on/off toggle while still
// remembering whether the coach has overridden the automatic default:
//   manual=false → AUTO: follow the local-device heuristic (isLikelyLocalDevice)
//   manual=true  → use `value` (the explicit on/off the coach picked)
// Shared by the Settings panel (the writer) and the engine's useKeepAwake hook.

import { readFlag, writeFlag } from './storage';

const VALUE_KEY = 'tjf.keepAwake';
const MANUAL_KEY = 'tjf.keepAwakeManual';

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
