// Persisted setlist: an ordered list of track ids the coach queued for a
// session. Stored separately from the routine list so it survives reloads.
const KEY = 'tjf.setlist';

export function loadSetlist(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveSetlist(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — the in-memory setlist still works this session */
  }
}
