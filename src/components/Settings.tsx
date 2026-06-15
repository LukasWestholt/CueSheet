import { useState } from 'react';
import {
  loadGetsongbpmKey,
  saveGetsongbpmKey,
  getsongbpmKeyUrl,
} from '../data/getsongbpmKey';
import { GETSONGBPM_URL } from '../links';

// App-wide settings. Currently just the optional GetSongBPM API key, which is
// per-user (a static site can't ship a shared secret) and lives in localStorage.
export default function Settings() {
  const [key, setKey] = useState(loadGetsongbpmKey);
  const [savedKey, setSavedKey] = useState(loadGetsongbpmKey);

  const save = () => {
    saveGetsongbpmKey(key);
    setSavedKey(loadGetsongbpmKey());
  };
  const clear = () => {
    saveGetsongbpmKey('');
    setKey('');
    setSavedKey('');
  };

  const dirty = key.trim() !== savedKey;
  const bookmarkUrl = savedKey ? getsongbpmKeyUrl(savedKey) : '';

  return (
    <details className="routines">
      <summary className="routines-head">
        <span className="muted">Settings</span>
        <span className="muted">BPM auto-fill {savedKey ? '· on' : '· off'}</span>
      </summary>

      <div className="field" style={{ marginTop: 10 }}>
        <span>
          GetSongBPM API key (optional) — auto-fills BPM when Deezer has none.{' '}
          <a href={`${GETSONGBPM_URL}/api`} target="_blank" rel="noreferrer">
            Get a free key
          </a>
          .
        </span>
        <div className="field-row">
          <input
            className="search-input"
            type="text"
            value={key}
            placeholder="Paste your GetSongBPM key"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setKey(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="ghost" onClick={save} disabled={!dirty}>
            Save
          </button>
          {savedKey && (
            <button className="link" onClick={clear}>
              Clear
            </button>
          )}
        </div>
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
    </details>
  );
}
