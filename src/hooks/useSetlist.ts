import { useMemo, useState } from 'react';
import type { Track } from '../data/tracks';
import { loadSetlist, saveSetlist } from '../data/setlistStore';
import { resolveSetlist } from '../data/setlist';

/**
 * The session queue: an ordered list of track ids, persisted, plus the derived
 * `sessionTracks` (resolved against the active routine list). Reordering and
 * launching the session (which touches navigation) stay with the caller.
 */
export function useSetlist(tracks: Track[]) {
  const [setlist, setSetlist] = useState<string[]>(loadSetlist);

  const persist = (next: string[]) => {
    saveSetlist(next);
    setSetlist(next);
  };

  const toggle = (id: string) =>
    persist(setlist.includes(id) ? setlist.filter((x) => x !== id) : [...setlist, id]);
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= setlist.length) return;
    const next = setlist.slice();
    [next[index], next[j]] = [next[j], next[index]];
    persist(next);
  };
  const remove = (id: string) => persist(setlist.filter((x) => x !== id));
  const clear = () => persist([]);

  const setlistSet = useMemo(() => new Set(setlist), [setlist]);
  const sessionTracks = useMemo(() => resolveSetlist(setlist, tracks), [setlist, tracks]);

  return { setlist, setlistSet, sessionTracks, toggle, move, remove, clear };
}
