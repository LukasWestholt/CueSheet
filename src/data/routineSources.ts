// Composable routine sources.
//
// The active routine list (tjf.tracks) is materialized — it's what the app
// renders and the editor mutates. On top of it sits a *source* layer: each
// routine file (one shipped in the server's public folder, or one the user
// uploaded) can be toggled on/off independently, and toggling merges or removes
// that file's tracks from the active list. A custom-uploaded file's content
// can't be re-fetched, so we keep it in localStorage; the set of enabled source
// keys is persisted so toggles survive a reload. Disabling every source leaves
// the active list empty — that's allowed.

import type { Track } from './tracks';

/** A routine file the user uploaded (kept locally; can't be re-fetched). */
export interface CustomFile {
  id: string;
  label: string;
  tracks: Track[];
}

/** Which source keys are currently merged, plus a one-time seed marker. */
export interface SourcesState {
  enabled: string[];
  /** True once the startup defaults have been applied (so a user who turns a
   *  default off doesn't get it re-enabled on the next load). */
  initialized: boolean;
}

/** A routine source as shown in the Routines panel (server file or custom upload). */
export interface RoutineSourceRow {
  key: string;
  label: string;
  description?: string;
  kind: 'server' | 'custom';
  /** True for a public-folder default file (loaded on first run). */
  isDefault: boolean;
  /** Whether the source is currently merged into the active list. */
  enabled: boolean;
}

const CUSTOM_KEY = 'tjf.customFiles';
const SOURCES_KEY = 'tjf.sources';

/** Source key for a public-folder file (keyed by its manifest path). */
export const serverSourceKey = (file: string): string => `srv:${file}`;
/** Source key for an uploaded custom file (keyed by its generated id). */
export const customSourceKey = (id: string): string => `cst:${id}`;

export function loadCustomFiles(): CustomFile[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (f): f is CustomFile =>
        typeof f === 'object' &&
        f !== null &&
        typeof f.id === 'string' &&
        typeof f.label === 'string' &&
        Array.isArray(f.tracks),
    );
  } catch {
    return [];
  }
}

export function saveCustomFiles(files: CustomFile[]): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(files));
  } catch {
    /* storage full / unavailable — the in-memory list still works this session */
  }
}

export function loadSourcesState(): SourcesState {
  try {
    const raw = localStorage.getItem(SOURCES_KEY);
    if (!raw) return { enabled: [], initialized: false };
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return { enabled: [], initialized: false };
    const enabled = Array.isArray(data.enabled)
      ? data.enabled.filter((k: unknown): k is string => typeof k === 'string')
      : [];
    return { enabled, initialized: data.initialized === true };
  } catch {
    return { enabled: [], initialized: false };
  }
}

export function saveSourcesState(state: SourcesState): void {
  try {
    localStorage.setItem(SOURCES_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Reasonably unique id for a freshly uploaded custom file. */
export function newCustomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Append `add` tracks onto `base`, skipping any whose id is already present
 * (first-wins dedup). Pure; used when a source is toggled on.
 */
export function mergeTracks(base: Track[], add: Track[]): Track[] {
  const have = new Set(base.map((t) => t.id));
  const out = base.slice();
  for (const t of add) {
    if (have.has(t.id)) continue;
    have.add(t.id);
    out.push(t);
  }
  return out;
}

/**
 * Drop tracks whose id is in `removeIds` *unless* it's also in `keepIds` (an id
 * still provided by another enabled source). Tracks owned by no source — e.g.
 * routines the coach authored in the editor — have ids in neither set, so they
 * always survive. Pure; used when a source is toggled off.
 */
export function removeTracksByIds(
  base: Track[],
  removeIds: Set<string>,
  keepIds: Set<string>,
): Track[] {
  return base.filter((t) => !(removeIds.has(t.id) && !keepIds.has(t.id)));
}