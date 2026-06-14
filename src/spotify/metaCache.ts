// A tiny two-layer cache for *immutable* Spotify track metadata: an in-memory
// Map for the session plus localStorage persistence so it survives reloads.
//
// Track metadata (title/artist/duration/bpm/first-beat) never changes for a
// given track, so these endpoints are pure functions of the track id and safe
// to cache forever. The cache is keyed by a caller-chosen namespace + id under
// the `tjf.meta.` localStorage prefix.
//
// Only successful results are ever stored (see `cached()` below). Callers must
// not pass `null`/failures here, so a transient 403/error can be retried later.

const PREFIX = 'tjf.meta.';

function storageKey(namespace: string, id: string): string {
  return `${PREFIX}${namespace}.${id}`;
}

/** Per-namespace in-memory layer, lazily populated from localStorage. */
const memory = new Map<string, unknown>();

/** Reads a cached value, checking memory first then localStorage. */
export function getCached<T>(namespace: string, id: string): T | undefined {
  const key = storageKey(namespace, id);
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return undefined;
    const value = JSON.parse(raw) as T;
    memory.set(key, value);
    return value;
  } catch {
    return undefined;
  }
}

/** Writes a value to both the memory and localStorage layers. */
export function setCached<T>(namespace: string, id: string, value: T): void {
  const key = storageKey(namespace, id);
  memory.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be full or unavailable (private mode); the memory layer
    // still works for the session, so swallow the error.
  }
}

/** Removes every cached entry (memory + localStorage). Useful for tests. */
export function clearCache(): void {
  memory.clear();
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) toRemove.push(key);
    }
    for (const key of toRemove) localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Memoizes an async metadata fetch. Returns the cached value when present;
 * otherwise runs `fetcher` and caches its result **only when it is non-null**.
 * Null/undefined results (failures, deprecated-endpoint 403s) are never cached,
 * so they stay retriable and cheap.
 */
export async function cached<T>(
  namespace: string,
  id: string,
  fetcher: () => Promise<T | null>,
): Promise<T | null> {
  const hit = getCached<T>(namespace, id);
  if (hit !== undefined) return hit;
  const value = await fetcher();
  if (value != null) setCached(namespace, id, value);
  return value;
}
