import { useEffect, useMemo, useState } from 'react';
import type { Track, StepCalling } from '../data/tracks';
import type { StepLibraryEntry } from '../data/stepLibrary';
import { validateTracks } from '../data/validateTracks';
import { getTrackInfo, searchTracks, type TrackSearchResult } from '../spotify/api';
import { getBpmByIsrc } from '../beatdata/deezer';
import { bpmAdvice, bpmLevelClass } from '../data/bpmAdvice';
import { checkRoutineLength, lengthWarning } from '../data/routineLength';
import { POPULAR_TRACKS, type PopularTrack } from '../data/popularTracks';
import { ArrowUp, ArrowDown, X } from './icons';

const TRACK_URI_RE = /^spotify:track:[A-Za-z0-9]{22}$/;

function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function blankTrack(): Track {
  return {
    id: `local-${Date.now().toString(36)}`,
    spotifyUri: '',
    steps: [{ step: '', cue: '', measures: 4 }],
  };
}

function numField(v: number | undefined): string {
  return v == null ? '' : String(v);
}
function parseOptionalNum(s: string): number | undefined {
  return s.trim() === '' ? undefined : Number(s);
}

export default function TrackEditor({
  initial,
  library,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: Track | null;
  library: StepLibraryEntry[];
  onSave: (track: Track) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Track>(() =>
    initial ? structuredClone(initial) : blankTrack(),
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Spotify track search (debounced) to fill the URI without pasting.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const id = setTimeout(() => {
      searchTracks(q)
        .then((r) => active && (setResults(r), setSearching(false)))
        .catch(() => active && (setResults([]), setSearching(false)));
    }, 300);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [query]);

  // Lazily look up each result's BPM from Deezer (by ISRC). Absent key = still
  // loading; null = no data; number = BPM.
  const [bpmByUri, setBpmByUri] = useState<Record<string, number | null>>({});
  useEffect(() => {
    setBpmByUri({});
    if (results.length === 0) return;
    let active = true;
    const set = (uri: string, bpm: number | null) =>
      active && setBpmByUri((m) => ({ ...m, [uri]: bpm }));
    for (const r of results) {
      if (!r.isrc) set(r.uri, null);
      else getBpmByIsrc(r.isrc).then((bpm) => set(r.uri, bpm)).catch(() => set(r.uri, null));
    }
    return () => {
      active = false;
    };
  }, [results]);

  // Recommend a BPM for the currently-set track (Deezer, by ISRC).
  // undefined = looking up, null = none found, number = recommendation.
  const [recBpm, setRecBpm] = useState<number | null | undefined>(null);
  // Track duration from Spotify, used for the routine-length check below.
  const [fetchedDurationMs, setFetchedDurationMs] = useState<number | null>(null);
  useEffect(() => {
    const uri = draft.spotifyUri;
    if (!TRACK_URI_RE.test(uri)) {
      setRecBpm(null);
      setFetchedDurationMs(null);
      return;
    }
    let active = true;
    setRecBpm(undefined);
    const id = setTimeout(() => {
      getTrackInfo(uri)
        .then((info) => {
          if (active) setFetchedDurationMs(info?.durationMs ?? null);
          return info?.isrc ? getBpmByIsrc(info.isrc) : null;
        })
        .then((bpm) => active && setRecBpm(bpm))
        .catch(() => {
          if (active) {
            setRecBpm(null);
            setFetchedDurationMs(null);
          }
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [draft.spotifyUri]);

  const chooseResult = (r: TrackSearchResult, bpm?: number) => {
    patch({
      spotifyUri: r.uri,
      title: draft.title ?? r.title,
      artist: draft.artist ?? r.artist,
      ...(bpm != null ? { bpm } : {}),
    });
    setQuery('');
    setResults([]);
  };

  const choosePopular = (p: PopularTrack) => {
    patch({
      spotifyUri: p.uri,
      title: draft.title ?? p.title,
      artist: draft.artist ?? p.artist,
      ...(p.bpm != null ? { bpm: p.bpm } : {}),
    });
    setQuery('');
    setResults([]);
  };

  // Offline quick-picks: when the search is empty and no track is set yet, show
  // the hard-coded popular tracks so a routine can be started without a network call.
  const showPopular =
    !draft.spotifyUri && query.trim() === '' && !searching && POPULAR_TRACKS.length > 0;

  const issues = useMemo(() => validateTracks([draft]).issues, [draft]);
  const hasErrors = issues.some((i) => i.level === 'error');

  const patch = (p: Partial<Track>) => setDraft((d) => ({ ...d, ...p }));
  const setStep = (i: number, p: Partial<StepCalling>) =>
    setDraft((d) => ({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) }));
  const addStep = () =>
    setDraft((d) => ({ ...d, steps: [...d.steps, { step: '', cue: '', measures: 4 }] }));
  const removeStep = (i: number) =>
    setDraft((d) => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }));
  const moveStep = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.steps.length) return d;
      const steps = d.steps.slice();
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });

  const togglePick = (name: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const insertPicked = () => {
    const toAdd: StepCalling[] = library
      .filter((e) => picked.has(e.step))
      .map((e) => ({ step: e.step, cue: e.cues[0] ?? '', measures: e.measures[0] ?? 4 }));
    if (toAdd.length) setDraft((d) => ({ ...d, steps: [...d.steps, ...toAdd] }));
    setPicked(new Set());
  };

  // BPM the routine will use (authored, else the online recommendation).
  const effBpm = draft.bpm ?? (typeof recBpm === 'number' ? recBpm : undefined);
  const advice = effBpm != null ? bpmAdvice(effBpm) : null;

  // Routine-vs-track length: does the timeline fit the song? Uses the best
  // available duration (authored, else fetched from Spotify).
  const effDurationMs = draft.durationMs ?? fetchedDurationMs ?? null;
  const lengthCheck = useMemo(
    () => checkRoutineLength(draft.steps, draft.firstBeatSec ?? 0, effBpm ?? null, effDurationMs),
    [draft.steps, draft.firstBeatSec, effBpm, effDurationMs],
  );
  // validateTracks already flags over/undershoot in the issues list when BOTH
  // bpm and duration are authored; only show the inline line otherwise (or to
  // give positive "fits" feedback).
  const lengthInIssues =
    draft.bpm != null && draft.durationMs != null && lengthCheck.status !== 'ok';
  const showLength = !draft.wip && lengthCheck.status !== 'unknown' && !lengthInIssues;

  return (
    <div className="editor">
      <header className="topbar">
        <button className="link" onClick={onCancel}>
          ‹ Cancel
        </button>
        <button className="primary" onClick={() => onSave(draft)} disabled={hasErrors}>
          Save
        </button>
      </header>

      <h2>{initial ? 'Edit routine' : 'New routine'}</h2>

      <div className="editor-fields">
        <label className="field">
          <span>Search Spotify</span>
          <input
            value={query}
            placeholder="song or artist…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {(searching || results.length > 0) && (
          <ul className="search-results">
            {searching && results.length === 0 && <li className="sr-status">Searching…</li>}
            {results.map((r) => {
              const known = r.uri in bpmByUri;
              const bpm = bpmByUri[r.uri];
              return (
                <li key={r.uri} className="sr-row">
                  <button className="sr-pick" onClick={() => chooseResult(r)}>
                    {r.imageUrl && (
                      <img className="sr-art" src={r.imageUrl} alt="" loading="lazy" />
                    )}
                    <span className="sr-meta">
                      <span className="sr-title">{r.title}</span>
                      <span className="sr-artist">{r.artist}</span>
                    </span>
                    <span className="sr-dur">{fmtDuration(r.durationMs)}</span>
                  </button>
                  <button
                    className={`sr-bpm-btn ${bpm != null ? bpmLevelClass(bpmAdvice(bpm).level) : ''}`}
                    onClick={() => bpm != null && chooseResult(r, bpm)}
                    disabled={bpm == null}
                    title={bpm != null ? `Use this track + BPM — ${bpmAdvice(bpm).label}` : undefined}
                  >
                    {!known ? '…' : bpm != null ? `${bpm} BPM` : 'no BPM'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {showPopular && (
          <div className="popular-picks">
            <span className="muted">Popular tracks</span>
            <ul className="popular-list">
              {POPULAR_TRACKS.map((p) => (
                <li key={p.uri}>
                  <button className="popular-pick" onClick={() => choosePopular(p)}>
                    <span className="pp-title">{p.title}</span>
                    <span className="pp-artist">{p.artist}</span>
                    {p.bpm != null && (
                      <span
                        className={`pp-bpm ${bpmLevelClass(bpmAdvice(p.bpm).level)}`}
                        title={bpmAdvice(p.bpm).label}
                      >
                        {p.bpm}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="field">
          <span>Spotify URI</span>
          <input
            value={draft.spotifyUri}
            placeholder="spotify:track:…"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => patch({ spotifyUri: e.target.value.trim() })}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>BPM</span>
            <input
              type="number"
              inputMode="numeric"
              className={draft.bpm != null ? bpmLevelClass(bpmAdvice(draft.bpm).level) : undefined}
              value={numField(draft.bpm)}
              placeholder="auto"
              onChange={(e) => patch({ bpm: parseOptionalNum(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>First beat (s)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={numField(draft.firstBeatSec)}
              placeholder="0"
              onChange={(e) => patch({ firstBeatSec: parseOptionalNum(e.target.value) })}
            />
          </label>
        </div>
        {advice && (
          <p className={`bpm-advice ${bpmLevelClass(advice.level)}`}>{advice.label}</p>
        )}
        {recBpm === undefined ? (
          <p className="hint">Looking up recommended BPM…</p>
        ) : typeof recBpm === 'number' ? (
          <p className="rec-bpm">
            Recommended BPM:{' '}
            <strong className={bpmLevelClass(bpmAdvice(recBpm).level)}>{recBpm}</strong> (Deezer)
            {draft.bpm === recBpm ? (
              <span className="rec-match"> ✓ in use</span>
            ) : (
              <button className="link" onClick={() => patch({ bpm: recBpm })}>
                Use
              </button>
            )}
          </p>
        ) : (
          TRACK_URI_RE.test(draft.spotifyUri) && (
            <p className="hint">No online BPM found for this track.</p>
          )
        )}
        {showLength &&
          (lengthCheck.status === 'ok' ? (
            <p className="length-note ok-note">
              ✓ Routine ≈ {fmtDuration(lengthCheck.routineEndSec * 1000)} of{' '}
              {fmtDuration(lengthCheck.trackDurationSec * 1000)}
            </p>
          ) : (
            <p className="length-note warning">⚠ {lengthWarning(lengthCheck)}</p>
          ))}
        <label className="field">
          <span>Title (optional)</span>
          <input
            value={draft.title ?? ''}
            placeholder="fetched from Spotify"
            onChange={(e) => patch({ title: e.target.value || undefined })}
          />
        </label>
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={draft.wip ?? false}
            onChange={(e) => patch({ wip: e.target.checked || undefined })}
          />
          <span>Work in progress (timings not finished)</span>
        </label>
      </div>

      <h3>Steps</h3>
      <ol className="editor-steps">
        {draft.steps.map((s, i) => (
          <li key={i} className="editor-step">
            <input
              className="step-name"
              value={s.step}
              placeholder="Move"
              onChange={(e) => setStep(i, { step: e.target.value })}
            />
            <input
              className="step-cue"
              value={s.cue ?? ''}
              placeholder="cue"
              onChange={(e) => setStep(i, { cue: e.target.value })}
            />
            <input
              className="step-measures"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0.5"
              value={s.measures}
              onChange={(e) => setStep(i, { measures: Number(e.target.value) })}
            />
            <div className="step-ops">
              <button className="icon-btn" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp size={18} />
              </button>
              <button
                className="icon-btn"
                onClick={() => moveStep(i, 1)}
                disabled={i === draft.steps.length - 1}
                aria-label="Move down"
              >
                <ArrowDown size={18} />
              </button>
              <button
                className="icon-btn danger"
                onClick={() => removeStep(i)}
                disabled={draft.steps.length === 1}
                aria-label="Delete step"
              >
                <X size={18} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button className="ghost add-step" onClick={addStep}>
        + Add step
      </button>

      {library.length > 0 && (
        <section className="library">
          <h3>Insert from library</h3>
          <div className="lib-chips">
            {library.map((e) => (
              <button
                key={e.step}
                className={`chip ${picked.has(e.step) ? 'chip-active' : ''}`}
                onClick={() => togglePick(e.step)}
              >
                {e.step} <span className="move-count">{e.count}×</span>
              </button>
            ))}
          </div>
          <button className="ghost" onClick={insertPicked} disabled={picked.size === 0}>
            Insert{picked.size > 0 ? ` ${picked.size}` : ''} selected
          </button>
        </section>
      )}

      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((iss, i) => (
            <li key={i} className={iss.level}>
              <span className="issue-where">{iss.where}</span> — {iss.message}
            </li>
          ))}
        </ul>
      )}

      {onDelete && (
        <button className="hold-btn danger-btn" onClick={onDelete}>
          Delete routine
        </button>
      )}
    </div>
  );
}
