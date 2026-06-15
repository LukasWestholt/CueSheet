// Routine files shipped alongside the deployment (in the web server's public
// folder). A static host can't list a directory, so a small manifest
// (public/routines.json) names the files. Files named `default.json` /
// `default.*.json` are loaded automatically on startup as the base routine set;
// any others are offered in the UI as one-tap import targets.

import type { Track } from './tracks';
import { validateTracks } from './validateTracks';

export interface RecommendedRoutine {
  /** Path of the JSON file to fetch, relative to the site root (or absolute URL). */
  file: string;
  label: string;
  description?: string;
}

/** Normalize a manifest-listed file to a root-absolute URL. */
function toUrl(file: string): string {
  return /^https?:\/\//.test(file) || file.startsWith('/') ? file : `/${file}`;
}

/**
 * Loads the optional manifest of recommended routine files. Accepts either a
 * bare array or `{ routines: [...] }`. Returns [] on any failure so the feature
 * is purely additive and never blocks startup (works offline once cached).
 */
export async function loadRecommendedRoutines(
  manifestUrl = '/routines.json',
): Promise<RecommendedRoutine[]> {
  try {
    const res = await fetch(manifestUrl, { cache: 'no-cache' });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const list = Array.isArray(data)
      ? data
      : typeof data === 'object' && data !== null
        ? (data as { routines?: unknown }).routines
        : null;
    if (!Array.isArray(list)) return [];
    return list
      .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
      .map((e) => ({
        file: typeof e.file === 'string' ? e.file : '',
        label:
          typeof e.label === 'string' && e.label
            ? e.label
            : typeof e.file === 'string'
              ? e.file
              : '',
        description: typeof e.description === 'string' ? e.description : undefined,
      }))
      .filter((e) => e.file);
  } catch {
    return [];
  }
}

/** Fetches and JSON-parses a routine file named by the manifest. Throws on failure. */
export async function fetchRoutineFile(file: string): Promise<unknown> {
  const res = await fetch(toUrl(file), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Couldn't load ${file} (HTTP ${res.status}).`);
  return res.json();
}

/** True for `default.json` and `default.<anything>.json` (auto-loaded on startup). */
export function isDefaultRoutineFile(file: string): boolean {
  const base = file.split('/').pop() ?? file;
  return /^default(\.[^/]+)?\.json$/i.test(base);
}

/**
 * Loads the startup default routine set from the public folder: every manifest
 * file named `default*.json`, validated and concatenated (deduped by id). Returns
 * [] when there's no manifest / no default files / all invalid, so the caller can
 * fall back to its built-in tracks. Never throws.
 */
export async function loadDefaultRoutines(manifestUrl = '/routines.json'): Promise<Track[]> {
  const defaults = (await loadRecommendedRoutines(manifestUrl)).filter((e) =>
    isDefaultRoutineFile(e.file),
  );
  const out: Track[] = [];
  const seen = new Set<string>();
  for (const e of defaults) {
    try {
      const data = await fetchRoutineFile(e.file);
      if (!validateTracks(data).ok) continue;
      for (const t of data as Track[]) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
      }
    } catch {
      /* skip an unreadable default file */
    }
  }
  return out;
}
