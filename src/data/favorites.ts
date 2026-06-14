// Favorite track ids, persisted in localStorage so a coach's starred routines
// survive reloads.
const KEY = 'tjf.favorites';

export function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveFavorites(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — favorites just won't persist this session */
  }
}
