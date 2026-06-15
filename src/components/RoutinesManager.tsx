import { useEffect, useMemo, useRef, useState } from 'react';
import type { Track } from '../data/tracks';
import { serializeTracks } from '../data/tracksStore';
import { validateTracks, type ValidationResult } from '../data/validateTracks';
import { collectStepLibrary } from '../data/stepLibrary';
import { isDefaultRoutine, type RecommendedRoutine } from '../data/recommendedImports';
import { REPO_URL } from '../links';

export default function RoutinesManager({
  tracks,
  overridden,
  onImport,
  onReset,
  recommended = [],
  onImportFile,
}: {
  tracks: Track[];
  /** True when the in-app list is an imported/edited override (not code-defined). */
  overridden: boolean;
  onImport: (tracks: Track[]) => void;
  onReset: () => void;
  /** Routine files served from the public folder, offered as import targets. */
  recommended?: RecommendedRoutine[];
  onImportFile?: (file: string) => Promise<ValidationResult>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showMoves, setShowMoves] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [contributeOpen, setContributeOpen] = useState(false);

  const importFile = async (entry: RecommendedRoutine) => {
    if (!onImportFile) return;
    setNote(null);
    setResult(null);
    setBusyFile(entry.file);
    try {
      const res = await onImportFile(entry.file);
      setResult(res);
      if (res.ok) setNote(`Imported ${res.trackCount} routines from “${entry.label}”.`);
    } catch (e) {
      setResult({
        ok: false,
        trackCount: 0,
        issues: [{ level: 'error', where: entry.file, message: e instanceof Error ? e.message : String(e) }],
      });
    } finally {
      setBusyFile(null);
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

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setNote(null);
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
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
      onImport(data as Track[]);
      setNote(`Imported ${res.trackCount} routines.`);
    }
  };

  return (
    <section className="routines">
      <div className="routines-head">
        <span className="muted">Routines{overridden ? ' · imported' : ''}</span>
        <span className="muted">{tracks.length} tracks · {library.length} moves</span>
      </div>

      <div className="routines-actions">
        <button className="ghost" onClick={exportJson}>
          Export
        </button>
        <button className="ghost" onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <button className="ghost" onClick={() => { setNote(null); setResult(validateTracks(tracks)); }}>
          Validate
        </button>
        {overridden && (
          <button
            className="link"
            onClick={() => { onReset(); setResult(null); setNote('Reverted to built-in routines.'); }}
          >
            Reset
          </button>
        )}
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>

      {recommended.length > 0 && onImportFile && (
        <div className="recommended">
          <span className="muted">Routine files on this server</span>
          <ul className="recommended-list">
            {recommended.map((r) => {
              const isDefault = isDefaultRoutine(r);
              return (
                <li key={r.file} className="recommended-row">
                  <span className="rec-meta">
                    <span className="rec-label">{r.label}</span>
                    {r.description && <span className="rec-desc">{r.description}</span>}
                  </span>
                  {isDefault ? (
                    <span className="badge rec-loaded" title="Auto-loaded on startup">
                      loaded
                    </span>
                  ) : (
                    <button
                      className="ghost"
                      onClick={() => importFile(r)}
                      disabled={busyFile != null}
                    >
                      {busyFile === r.file ? 'Importing…' : 'Import'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <button className="link" onClick={() => setContributeOpen(true)}>
            + Contribute a routine
          </button>
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
        Export is a backup of your routines (your edits on this device). Import
        replaces the in-app list on this device.
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
          ✕
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
