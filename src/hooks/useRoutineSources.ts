import { useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../data/tracks';
import { TRACKS } from '../data/tracks';
import { loadStoredTracks, saveStoredTracks } from '../data/tracksStore';
import { validateTracks } from '../data/validateTracks';
import {
  loadRecommendedRoutines,
  fetchRoutineFile,
  isDefaultRoutine,
  type RecommendedRoutine,
} from '../data/recommendedImports';
import {
  type CustomFile,
  type SourcesState,
  type RoutineSourceRow,
  loadCustomFiles,
  saveCustomFiles,
  loadSourcesState,
  saveSourcesState,
  serverSourceKey,
  customSourceKey,
  newCustomId,
  mergeTracks,
  removeTracksByIds,
} from '../data/routineSources';
import { collectStepLibrary } from '../data/stepLibrary';

/** The materialized active list: a valid stored list, else the code-defined set. */
function initialTracks(): Track[] {
  const stored = loadStoredTracks();
  if (stored && validateTracks(stored).ok) return stored;
  return TRACKS;
}

/**
 * Enabled-source state at mount. A pre-existing stored list (from before the
 * source model) counts as already initialized so we don't merge the default
 * files on top of it — its tracks just have no source provenance until the user
 * toggles things.
 */
function initialSources(): SourcesState {
  const s = loadSourcesState();
  if (s.initialized) return s;
  if (loadStoredTracks() != null) return { enabled: s.enabled, initialized: true };
  return s;
}

/**
 * Owns the composable routine-source layer: the materialized active list
 * (`tracks`), uploaded custom files, the set of enabled sources, the
 * public-folder recommended files, and every merge/toggle/reset operation.
 * `onListReplaced` runs whenever the list is fully replaced (so the caller can
 * reset navigation selection); it is skipped for in-place edits.
 */
export function useRoutineSources({ onListReplaced }: { onListReplaced?: () => void } = {}) {
  // The materialized active routine list (what the app renders + the editor edits).
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  // Composable routine sources: uploaded files + which source keys are merged.
  const [customFiles, setCustomFiles] = useState<CustomFile[]>(loadCustomFiles);
  const [sources, setSources] = useState<SourcesState>(initialSources);
  const enabledSet = useMemo(() => new Set(sources.enabled), [sources.enabled]);
  // In-memory cache of fetched server-file contents (file path -> tracks).
  const serverContent = useRef<Map<string, Track[]>>(new Map());
  // Routine files shipped in the web server's public folder (see public/routines.json).
  const [recommended, setRecommended] = useState<RecommendedRoutine[]>([]);

  const stepLibrary = useMemo(() => collectStepLibrary(tracks), [tracks]);

  // Commit the materialized active list. `resetSelection` is off for in-place
  // edits (tap-to-time) so the player keeps its current track.
  const commitTracks = (next: Track[], resetSelection = true) => {
    saveStoredTracks(next);
    setTracks(next);
    if (resetSelection) onListReplaced?.();
  };
  const persistCustomFiles = (next: CustomFile[]) => {
    saveCustomFiles(next);
    setCustomFiles(next);
  };
  const persistSources = (next: SourcesState) => {
    saveSourcesState(next);
    setSources(next);
  };

  // Resolve a source's tracks: server files are fetched + validated + cached;
  // custom files come from localStorage. Returns [] on any failure.
  const getSourceTracks = async (key: string): Promise<Track[]> => {
    if (key.startsWith('srv:')) {
      const file = key.slice(4);
      const cached = serverContent.current.get(file);
      if (cached) return cached;
      try {
        const data = await fetchRoutineFile(file);
        if (!validateTracks(data).ok) return [];
        const list = data as Track[];
        serverContent.current.set(file, list);
        return list;
      } catch {
        return [];
      }
    }
    if (key.startsWith('cst:')) {
      return customFiles.find((f) => customSourceKey(f.id) === key)?.tracks ?? [];
    }
    return [];
  };

  // Disable a source: drop its tracks from the active list, but keep any id
  // another still-enabled source provides; tracks owned by no source (authored
  // in the editor) always stay.
  const disableSource = async (key: string) => {
    const own = await getSourceTracks(key);
    const otherKeys = sources.enabled.filter((k) => k !== key);
    const keepIds = new Set<string>();
    for (const k of otherKeys) for (const t of await getSourceTracks(k)) keepIds.add(t.id);
    commitTracks(removeTracksByIds(tracks, new Set(own.map((t) => t.id)), keepIds));
    persistSources({ ...sources, enabled: otherKeys });
  };

  // Materialize the public-folder default files into one merged list + the set
  // of enabled source keys (shared by first-run seeding and Reset).
  const materializeDefaultSources = async (recs: RecommendedRoutine[]) => {
    let list: Track[] = [];
    const enabled: string[] = [];
    for (const r of recs.filter(isDefaultRoutine)) {
      const content = await getSourceTracks(serverSourceKey(r.file));
      if (!content.length) continue;
      list = mergeTracks(list, content);
      enabled.push(serverSourceKey(r.file));
    }
    return { list, enabled };
  };

  // Merge a source into the active list, or remove it.
  const toggleSource = async (key: string) => {
    if (enabledSet.has(key)) {
      await disableSource(key);
    } else {
      const own = await getSourceTracks(key);
      commitTracks(mergeTracks(tracks, own));
      persistSources({ ...sources, enabled: [...sources.enabled, key] });
    }
  };

  // Upload (formerly "Import"): add the file to the custom list, disabled — the
  // coach loads it with one tap. Never replaces the active list.
  const addCustomFile = (label: string, data: Track[]) =>
    persistCustomFiles([...customFiles, { id: newCustomId(), label, tracks: data }]);

  const removeCustomFile = async (id: string) => {
    const key = customSourceKey(id);
    if (enabledSet.has(key)) await disableSource(key);
    persistCustomFiles(customFiles.filter((f) => f.id !== id));
  };

  // Reset: re-enable just the public-folder defaults and materialize them,
  // falling back to the built-in tracks if none load (e.g. offline).
  const resetTracks = async () => {
    const { list, enabled } = await materializeDefaultSources(recommended);
    commitTracks(list.length ? list : TRACKS);
    persistSources({ enabled, initialized: true });
  };

  // Update a single track in place (tap-to-time). Matched by id, not index, so it
  // works whether the player is showing the full list or a setlist session.
  const updateTrack = (updated: Track) => {
    commitTracks(
      tracks.map((t) => (t.id === updated.id ? updated : t)),
      false,
    );
  };

  const seededRef = useRef(false);
  useEffect(() => {
    loadRecommendedRoutines()
      .then(async (recs) => {
        setRecommended(recs);
        if (seededRef.current || sources.initialized) return;
        seededRef.current = true;
        // First run: enable the default files and materialize them as the base set.
        const { list, enabled } = await materializeDefaultSources(recs);
        if (enabled.length) {
          commitTracks(list);
          persistSources({ enabled, initialized: true });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The routine sources shown in the Routines panel: server files then customs.
  const sourceRows: RoutineSourceRow[] = useMemo(() => {
    const server: RoutineSourceRow[] = recommended.map((r) => ({
      key: serverSourceKey(r.file),
      label: r.label,
      description: r.description,
      kind: 'server',
      isDefault: isDefaultRoutine(r),
      enabled: enabledSet.has(serverSourceKey(r.file)),
    }));
    const custom: RoutineSourceRow[] = customFiles.map((f) => ({
      key: customSourceKey(f.id),
      label: f.label,
      kind: 'custom',
      isDefault: false,
      enabled: enabledSet.has(customSourceKey(f.id)),
    }));
    return [...server, ...custom];
  }, [recommended, customFiles, enabledSet]);

  return {
    tracks,
    stepLibrary,
    sourceRows,
    commitTracks,
    updateTrack,
    toggleSource,
    addCustomFile,
    removeCustomFile,
    resetTracks,
  };
}
