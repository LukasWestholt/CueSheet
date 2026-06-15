import { useEffect, useRef, useState } from 'react';
import {
  loadGetsongbpmKey,
  saveGetsongbpmKey,
  getsongbpmKeyUrl,
} from '../data/getsongbpmKey';
import { testGetsongbpmKey } from '../beatdata/getsongbpm';
import { GETSONGBPM_URL, REPO_URL } from '../links';
import { X } from './icons';

// App-wide settings. Currently just the optional GetSongBPM API key, which is
// per-user (a static site can't ship a shared secret) and lives in localStorage.
export default function Settings() {
  const [key, setKey] = useState(loadGetsongbpmKey);
  const [savedKey, setSavedKey] = useState(loadGetsongbpmKey);
  const [helpOpen, setHelpOpen] = useState(false);
  const [test, setTest] = useState<
    { state: 'idle' | 'testing' } | { state: 'ok' } | { state: 'fail'; reason: string }
  >({ state: 'idle' });

  const save = () => {
    saveGetsongbpmKey(key);
    setSavedKey(loadGetsongbpmKey());
  };
  const clear = () => {
    saveGetsongbpmKey('');
    setKey('');
    setSavedKey('');
    setTest({ state: 'idle' });
  };
  const runTest = async () => {
    setTest({ state: 'testing' });
    const result = await testGetsongbpmKey(key);
    setTest(result.ok ? { state: 'ok' } : { state: 'fail', reason: result.reason });
  };
  const onKeyChange = (value: string) => {
    setKey(value);
    setTest({ state: 'idle' });
  };

  const dirty = key.trim() !== savedKey;
  const bookmarkUrl = savedKey ? getsongbpmKeyUrl(savedKey) : '';

  return (
    <details className="routines">
      <summary className="routines-head">
        <span className="muted">Settings</span>
        <span className="muted">BPM auto-fill {savedKey ? '· on' : '· off'}</span>
      </summary>

      <div className="field" style={{ marginTop: 'var(--space-3)' }}>
        <span>
          GetSongBPM API key (optional) — auto-fills BPM when Deezer has none.{' '}
          <a href={`${GETSONGBPM_URL}/api`} target="_blank" rel="noreferrer">
            Get a free key
          </a>{' '}
          or{' '}
          <button type="button" className="linkish" onClick={() => setHelpOpen(true)}>
            how do I get one?
          </button>
        </span>
        <div className="field-row">
          <input
            className="search-input"
            type="text"
            value={key}
            placeholder="Paste your GetSongBPM key"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onKeyChange(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="ghost"
            onClick={runTest}
            disabled={!key.trim() || test.state === 'testing'}
          >
            {test.state === 'testing' ? 'Testing…' : 'Test'}
          </button>
          <button className="ghost" onClick={save} disabled={!dirty}>
            Save
          </button>
          {savedKey && (
            <button className="link" onClick={clear}>
              Clear
            </button>
          )}
        </div>
        {test.state === 'ok' && (
          <p className="hint" style={{ color: 'var(--accent)' }}>
            ✓ Key works — BPM auto-fill is ready.
          </p>
        )}
        {test.state === 'fail' && (
          <p className="hint" style={{ color: 'var(--danger)' }}>
            ✕ {test.reason}
          </p>
        )}
      </div>

      {savedKey && (
        <p className="hint">
          Bookmark{' '}
          <a href={bookmarkUrl}>this link</a> to re-apply your key on another
          device. The key is stored only in this browser and counts against your
          own GetSongBPM quota.
        </p>
      )}
      <p className="hint">
        Using GetSongBPM requires a visible link back to{' '}
        <a href={GETSONGBPM_URL} target="_blank" rel="noreferrer">
          getsongbpm.com
        </a>{' '}
        — it’s shown in the landing-page footer and the page source.
      </p>

      <ApiKeyHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </details>
  );
}

/** This app's origin, shown as a ready-to-paste example URL in the help modal. */
function appOrigin(): string {
  try {
    return window.location.origin;
  } catch {
    return 'https://your-app-url';
  }
}

// Instruction modal: walks a coach through registering for a free GetSongBPM
// API key. Uses the native <dialog> (showModal gives us the backdrop, Esc-to-
// close, and focus trapping for free) driven by the `open` prop.
function ApiKeyHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        <strong>Get a free GetSongBPM key</strong>
        <button type="button" className="link" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <p className="hint">
        The key is free and only used to auto-fill BPM when Deezer doesn’t have
        it. It stays in this browser — paste it above when you’re done.
      </p>

      <ol className="modal-steps">
        <li>
          Open{' '}
          <a href={`${GETSONGBPM_URL}/api`} target="_blank" rel="noreferrer">
            getsongbpm.com/api
          </a>
          . The form has three fields.
        </li>
        <li>
          <strong>Website URL or App ID/Package Name</strong> — the site where
          your backlink lives. Paste this app’s address (e.g.{' '}
          <code>{appOrigin()}</code>), or your own page.
        </li>
        <li>
          <strong>Backlink URL</strong> (mandatory) — a public link back to{' '}
          <a href={GETSONGBPM_URL} target="_blank" rel="noreferrer">
            getsongbpm.com
          </a>
          . GetSongBPM reads the raw page source to verify it and suspends keys
          without one. This app already ships that backlink in its page footer
          and HTML source, so the hosted app’s URL counts.
        </li>
        <li>
          <strong>Email</strong> — a valid address; the key is sent here to
          activate it.
        </li>
        <li>
          Press <strong>GET API KEY</strong>. The key arrives by email (check
          spam if it’s slow).
        </li>
        <li>
          Open that email and <strong>click the activation link</strong> — the
          key won’t work until you do.
        </li>
        <li>
          Copy the key from the email and{' '}
          <strong>paste it into the field above</strong>, then press{' '}
          <strong>Save</strong>. Done — BPM auto-fill turns on.
        </li>
      </ol>

      <p className="hint">
        Tip: after saving, use the bookmark link to re-apply your key on another
        device without registering again. App source for the backlink lives at{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        .
      </p>

      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onClose}>
          Got it
        </button>
      </div>
    </dialog>
  );
}
