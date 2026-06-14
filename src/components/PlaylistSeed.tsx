import { useEffect, useState } from 'react';
import type { Track } from '../data/tracks';
import { getPlaylistTracks, type PlaylistTrack } from '../spotify/api';
import { getBpmByIsrc } from '../beatdata/deezer';
import { bpmAdvice, bpmLevelClass } from '../data/bpmAdvice';

export default function PlaylistSeed({
  existingUris,
  onAdd,
  onCancel,
}: {
  existingUris: Set<string>;
  onAdd: (stubs: Track[]) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PlaylistTrack[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bpmByUri, setBpmByUri] = useState<Record<string, number | null>>({});

  const load = async () => {
    setError(null);
    setLoading(true);
    setItems([]);
    setSelected(new Set());
    try {
      const tracks = await getPlaylistTracks(input);
      setItems(tracks);
      if (tracks.length === 0) setError('No tracks found — check the playlist link.');
      // Preselect tracks not already in the routine list.
      setSelected(new Set(tracks.filter((t) => !existingUris.has(t.uri)).map((t) => t.uri)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Lazily look up each track's BPM (Deezer, by ISRC).
  useEffect(() => {
    setBpmByUri({});
    if (items.length === 0) return;
    let active = true;
    const set = (uri: string, bpm: number | null) =>
      active && setBpmByUri((m) => ({ ...m, [uri]: bpm }));
    for (const t of items) {
      if (!t.isrc) set(t.uri, null);
      else getBpmByIsrc(t.isrc).then((bpm) => set(t.uri, bpm)).catch(() => set(t.uri, null));
    }
    return () => {
      active = false;
    };
  }, [items]);

  const toggle = (uri: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });

  const add = () => {
    const stamp = Date.now().toString(36);
    const stubs: Track[] = items
      .filter((t) => selected.has(t.uri))
      .map((t, i) => {
        const bpm = bpmByUri[t.uri];
        return {
          id: `local-${stamp}-${i}`,
          spotifyUri: t.uri,
          title: t.title,
          artist: t.artist,
          ...(typeof bpm === 'number' ? { bpm } : {}),
          steps: [{ step: 'Step 1', cue: '', measures: 8 }],
        };
      });
    if (stubs.length) onAdd(stubs);
  };

  return (
    <div className="editor">
      <header className="topbar">
        <button className="link" onClick={onCancel}>
          ‹ Cancel
        </button>
        <button className="primary" onClick={add} disabled={selected.size === 0}>
          Add {selected.size}
        </button>
      </header>

      <h2>Seed from a Spotify playlist</h2>

      <div className="field-row">
        <input
          className="search-input"
          value={input}
          placeholder="playlist link or URI"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="ghost" onClick={load} disabled={loading || !input.trim()}>
          {loading ? '…' : 'Load'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {items.length > 0 && (
        <>
          <p className="hint">
            {selected.size}/{items.length} selected · each becomes an editable routine stub
            (with its BPM when available).
          </p>
          <ul className="seed-list">
            {items.map((t) => {
              const already = existingUris.has(t.uri);
              const known = t.uri in bpmByUri;
              const bpm = bpmByUri[t.uri];
              return (
                <li key={t.uri} className="seed-item">
                  <label className="seed-pick">
                    <input
                      type="checkbox"
                      checked={selected.has(t.uri)}
                      onChange={() => toggle(t.uri)}
                    />
                    <span className="sr-meta">
                      <span className="sr-title">
                        {t.title}
                        {already && <span className="seed-already"> · already added</span>}
                      </span>
                      <span className="sr-artist">{t.artist}</span>
                    </span>
                  </label>
                  <span
                    className={`sr-bpm-static ${
                      typeof bpm === 'number' ? bpmLevelClass(bpmAdvice(bpm).level) : ''
                    }`}
                  >
                    {!known ? '…' : typeof bpm === 'number' ? `${bpm} BPM` : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
