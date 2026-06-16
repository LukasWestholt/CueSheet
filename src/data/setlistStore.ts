// Persisted setlist: an ordered list of track ids the coach queued for a
// session. Stored separately from the routine list so it survives reloads.
import { readJSON, writeJSON } from './storage';

const KEY = 'tjf.setlist';

export function loadSetlist(): string[] {
  return readJSON(KEY, [] as string[], (data) =>
    Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : [],
  );
}

export function saveSetlist(ids: string[]): void {
  writeJSON(KEY, ids);
}
