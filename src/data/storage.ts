// Thin wrappers around localStorage so every store doesn't re-implement the
// same try/catch (storage can throw: private mode, quota, disabled). Reads fall
// back to a default; writes/removes fail silently (the in-memory state still
// works for the session).

/**
 * Reads + JSON-parses `key`, returning `fallback` when absent or on any error.
 * Pass `parse` to validate/transform the parsed value (e.g. coerce to a Set or
 * filter a list); it only runs on a successful parse.
 */
export function readJSON<T>(key: string, fallback: T, parse?: (data: unknown) => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const data: unknown = JSON.parse(raw);
    return parse ? parse(data) : (data as T);
  } catch {
    return fallback;
  }
}

/** JSON-stringifies and stores `value`; no-op if storage is unavailable. */
export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — in-memory state still works this session */
  }
}

/** Removes `key`; no-op if storage is unavailable. */
export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Reads a boolean flag stored as '1'/'0' (absent/unreadable → false). */
export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Stores a boolean flag as '1'/'0'; no-op if storage is unavailable. */
export function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* storage unavailable — value just won't persist this session */
  }
}

/** All stored keys starting with `prefix` ([] if storage is unavailable). */
export function keysWithPrefix(prefix: string): string[] {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    return keys;
  } catch {
    return [];
  }
}

/** Reads a raw string, returning `fallback` when absent or unreadable. */
export function readString(key: string, fallback = ''): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Stores a raw string; an empty value removes the key. No-op if unavailable. */
export function writeString(key: string, value: string): void {
  try {
    if (value === '') localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — value just won't persist this session */
  }
}
