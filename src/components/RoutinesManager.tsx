import { useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../data/tracks';
import { serializeTracks } from '../data/tracksStore';
import { validateTracks, type ValidationResult } from '../data/validateTracks';
import { collectStepLibrary } from '../data/stepLibrary';
import type { RoutineSourceRow } from '../data/routineSources';
import { REPO_URL } from '../links';
import { X, Check, Plus } from './icons';

export default function RoutinesManager({
  tracks,
  sources,
  onToggleSource,
  onAddCustom,
  onRemoveCustom,
  onReset,
}: {
  tracks: Track[];
  /** All routine sources (public-folder files + custom uploads) with toggle state. */
  sources: RoutineSourceRow[];
  /** Merge a source into / remove it from the active list. */
  onToggleSource: (key: string) => Promise<void>;
  /** Add an uploaded routine file to the custom list (does not load it). */
  onAddCustom: (label: string, tracks: Track[]) => void;
  /** Remove an uploaded custom file (unloading it first if active). */
  onRemoveCustom: (id: string) => void;
  /** Re-enable just the public-folder defaults. */
  onReset: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showMoves, setShowMoves] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [contributeOpen, setContributeOpen] = useState(false);

  const serverSources = sources.filter((s) => s.kind === 'server');
  const customSources = sources.filter((s) => s.kind === 'custom');

  const toggle = async (key: string) => {
    setNote(null);
    setResult(null);
    setBusyKey(key);
    try {
      await onToggleSource(key);
    } finally {
      setBusyKey(null);
    }
  };

  const library = useMemo(() => collectStepLibrary(tracks), [tracks]);

  const exportJson = () => {
    const blob = new Blob([serializeTracks(tracks)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuesheet-routines-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNote(`Exported ${tracks.length} routines.`);
    setResult(null);
  };

  // Upload a routine file: it joins the "Custom routine files" list (disabled),
  // then one tap loads it. Never replaces the active list.
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setNote(null);
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same file
    if (!file) return;
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setResult({ ok: false, trackCount: 0, issues: [{ level: 'error', where: 'file', message: 'Not valid JSON.' }] });
      return;
    }
    const res = validateTracks(data);
    setResult(res);
    if (res.ok) {
      const label = file.name.replace(/\.json$/i, '') || 'Uploaded routines';
      onAddCustom(label, data as Track[]);
      setNote(`Added “${label}” (${res.trackCount} routines). Tap Load to use it.`);
    }
  };

  const renderRow = (s: RoutineSourceRow) => (
    <li key={s.key} className="source-row">
      <span className="rec-meta">
        <span className="rec-label">
          {s.label}
          {s.isDefault && <span className="badge source-default">default</span>}
        </span>
        {s.description && <span className="rec-desc">{s.description}</span>}
      </span>
      <button
        className={`source-toggle ${s.enabled ? 'is-on' : ''}`}
        aria-pressed={s.enabled}
        disabled={busyKey != null}
        onClick={() => toggle(s.key)}
      >
        {busyKey === s.key ? (
          '…'
        ) : s.enabled ? (
          <>
            <Check size={16} /> Loaded
          </>
        ) : (
          <>
            <Plus size={16} /> Load
          </>
        )}
      </button>
      {s.kind === 'custom' && (
        <button
          className="source-remove"
          aria-label={`Remove ${s.label}`}
          title="Remove this file"
          disabled={busyKey != null}
          onClick={() => onRemoveCustom(s.key.slice(4))}
        >
          <X size={16} />
        </button>
      )}
    </li>
  );

  return (
    <section className="routines">
      <div className="routines-head">
        <span className="muted">Routines</span>
        <span className="muted">{tracks.length} tracks · {library.length} moves</span>
      </div>

      <div className="routines-actions">
        <button className="ghost" onClick={exportJson}>
          Export
        </button>
        <button className="ghost" onClick={() => fileRef.current?.click()}>
          Upload
        </button>
        <button className="ghost" onClick={() => { setNote(null); setResult(validateTracks(tracks)); }}>
          Validate
        </button>
        <button
          className="link"
          onClick={() => { onReset(); setResult(null); setNote('Re-enabled the default routine files.'); }}
        >
          Reset
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>

      {serverSources.length > 0 && (
        <div className="recommended">
          <span className="muted">Routine files on this server</span>
          <ul className="recommended-list">{serverSources.map(renderRow)}</ul>
          <button className="link" onClick={() => setContributeOpen(true)}>
            + Contribute a routine
          </button>
        </div>
      )}

      {customSources.length > 0 && (
        <div className="recommended">
          <span className="muted">Custom routine files</span>
          <ul className="recommended-list">{customSources.map(renderRow)}</ul>
        </div>
      )}

      <ContributeHelp open={contributeOpen} onClose={() => setContributeOpen(false)} />

      {note && <p className="hint">{note}</p>}

      {result && (
        <div className="routines-result">
          {result.issues.length === 0 ? (
            <p className="ok-note">✓ {result.trackCount} routines, no issues.</p>
          ) : (
            <ul className="issues">
              {result.issues.map((iss, i) => (
                <li key={i} className={iss.level}>
                  <span className="issue-where">{iss.where}</span> — {iss.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button className="link moves-toggle" onClick={() => setShowMoves((v) => !v)}>
        {showMoves ? 'Hide' : 'Show'} moves used
      </button>
      {showMoves && (
        <ul className="moves-list">
          {library.map((e) => (
            <li key={e.step}>
              <span className="move-name">{e.step}</span>
              <span className="move-count">{e.count}×</span>
            </li>
          ))}
        </ul>
      )}

      <p className="hint">
        Each routine file can be loaded or unloaded independently — the active
        list is everything currently loaded (it can be empty). Upload adds a file
        to “Custom routine files” without loading it. Export backs up the active
        list; it stays on this device.
      </p>
    </section>
  );
}

// Instruction modal: how to contribute a routine file to the project by opening
// a pull request. Uses the native <dialog> (showModal gives the backdrop,
// Esc-to-close and focus trapping for free), driven by the `open` prop — same
// pattern as Settings' ApiKeyHelp.
function ContributeHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-head">
        <strong>Contribute a routine</strong>
        <button type="button" className="link" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <p className="hint">
        CueSheet is open source — the routine files everyone sees are committed to
        the repository. To add your own, open a pull request:
      </p>

      <ol className="modal-steps">
        <li>
          Author and verify your routine in the app, then <strong>Export</strong>{' '}
          it (above) to download a <code>.json</code> file.
        </li>
        <li>
          Fork{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            the repository
          </a>{' '}
          and drop your file into the <code>public/</code> directory, e.g.{' '}
          <code>public/my-routine.json</code>.
        </li>
        <li>
          Add an entry for it to <code>public/routines.json</code> so the app lists
          it:
          <pre className="code-block">{`{
  "file": "/my-routine.json",
  "label": "My routine"
}`}</pre>
          Leave out <code>"default": true</code> — that flag is reserved for the
          base set that loads on startup; your file becomes a one-tap import.
        </li>
        <li>
          Open a <strong>pull request</strong>. Once it's merged, your routine
          ships to everyone on the next deploy.
        </li>
      </ol>

      <div className="modal-actions">
        <a className="ghost" href={`${REPO_URL}/tree/main/public`} target="_blank" rel="noreferrer">
          Open public/ on GitHub
        </a>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
