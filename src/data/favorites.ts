// Favorite track ids, persisted in localStorage so a coach's starred routines
// survive reloads.
import { readJSON, writeJSON } from './storage';

const KEY = 'tjf.favorites';

export function loadFavorites(): Set<string> {
  return readJSON(
    KEY,
    new Set<string>(),
    (data) => new Set(Array.isArray(data) ? (data as string[]) : []),
  );
}

export function saveFavorites(ids: Set<string>): void {
  writeJSON(KEY, [...ids]);
}
