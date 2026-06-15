// The user's own GetSongBPM API key (https://getsongbpm.com/api), stored in
// localStorage — NOT baked into the bundle. A client-only static site can't
// hide a secret, so rather than ship one shared key we let each user paste
// their own free key; it stays on their device and counts against their quota.
//
// Convenience: the key can also arrive via a `?getsongbpm_key=…` URL parameter,
// so a coach can bookmark a link that re-applies their key on any device. We
// persist it and strip the param from the visible URL (the bookmark keeps it).

const KEY = 'tjf.getsongbpmKey';
const URL_PARAM = 'getsongbpm_key';

export function loadGetsongbpmKey(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveGetsongbpmKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(KEY, trimmed);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — the key just won't persist this session */
  }
}

/** A bookmarkable URL that re-applies the given key on any device. */
export function getsongbpmKeyUrl(key: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(URL_PARAM, key.trim());
  return url.toString();
}

/**
 * If the current URL carries `?getsongbpm_key=…`, persist it and strip the
 * param from the address bar (replaceState). Returns true if a key was applied.
 * Safe to call once on startup; only touches the query string, not the path.
 */
export function ingestGetsongbpmKeyFromUrl(): boolean {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get(URL_PARAM);
    if (!param) return false;
    saveGetsongbpmKey(param);
    url.searchParams.delete(URL_PARAM);
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    return true;
  } catch {
    return false;
  }
}
