import { useEffect, useMemo, useState } from 'react';
import { IS_CONFIGURED } from './config';
import { handleRedirectCallback, isLoggedIn, logout } from './spotify/auth';
import { getPlaybackState, getTracksInfo, type TrackInfo } from './spotify/api';
import { TRACKS, type Track } from './data/tracks';
import { clearStoredTracks, loadStoredTracks, saveStoredTracks } from './data/tracksStore';
import { validateTracks } from './data/validateTracks';
import { collectStepLibrary } from './data/stepLibrary';
import LoginScreen from './components/LoginScreen';
import TrackList from './components/TrackList';
import PlayerScreen from './components/PlayerScreen';
import DevicePicker from './components/DevicePicker';
import RoutinesManager from './components/RoutinesManager';
import TrackEditor from './components/TrackEditor';

/** Use a valid stored override if present, else the code-defined routines. */
function initialTracks(): { tracks: Track[]; overridden: boolean } {
  const stored = loadStoredTracks();
  if (stored && validateTracks(stored).ok) return { tracks: stored, overridden: true };
  return { tracks: TRACKS, overridden: false };
}

type View = 'list' | 'player' | 'editor';

export default function App() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<View>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [resume, setResume] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [trackInfos, setTrackInfos] = useState<Record<string, TrackInfo>>({});
  const [infosError, setInfosError] = useState<string | null>(null);
  // Index of one of our tracks that Spotify is already playing (e.g. after a reload).
  const [resumeIndex, setResumeIndex] = useState<number | null>(null);
  // The routine list: a stored override (imported/edited) or the code-defined set.
  const [{ tracks, overridden }, setTrackState] = useState(initialTracks);
  // When view === 'editor': index of the track being edited, or null for a new one.
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const stepLibrary = useMemo(() => collectStepLibrary(tracks), [tracks]);

  const openTrack = (index: number, asResume = false) => {
    setSelectedIndex(index);
    setResume(asResume);
    setView('player');
  };

  const persistTracks = (next: Track[], overrideOff = false) => {
    if (overrideOff) clearStoredTracks();
    else saveStoredTracks(next);
    setTrackState({ tracks: next, overridden: !overrideOff });
    setSelectedIndex(0);
    setResumeIndex(null);
  };
  const importTracks = (next: Track[]) => persistTracks(next);
  const resetTracks = () => persistTracks(TRACKS, true);

  // Update a single track in place (tap-to-time) without resetting the player's
  // selection — keeps the same Spotify track playing with the new timing.
  const updateTrack = (index: number, updated: Track) => {
    const next = tracks.map((t, i) => (i === index ? updated : t));
    saveStoredTracks(next);
    setTrackState({ tracks: next, overridden: true });
  };

  const openEditor = (index: number | null) => {
    setEditIndex(index);
    setView('editor');
  };
  const saveTrack = (track: Track) => {
    const next =
      editIndex == null
        ? [...tracks, track]
        : tracks.map((t, i) => (i === editIndex ? track : t));
    persistTracks(next);
    setView('list');
  };
  const deleteTrack = () => {
    if (editIndex == null) return;
    persistTracks(tracks.filter((_, i) => i !== editIndex));
    setView('list');
  };

  // Handle the OAuth redirect, then determine login state.
  useEffect(() => {
    (async () => {
      try {
        if (window.location.pathname === '/callback') {
          await handleRedirectCallback();
        }
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoggedIn(isLoggedIn());
        setReady(true);
      }
    })();
  }, []);

  // Once logged in, fetch list metadata (titles/durations) in one batch.
  useEffect(() => {
    if (!loggedIn) return;
    getTracksInfo(tracks.map((t) => t.spotifyUri))
      .then((infos) => {
        setTrackInfos(infos);
        setInfosError(null);
      })
      .catch((e) => setInfosError(e instanceof Error ? e.message : String(e)));
  }, [loggedIn, tracks]);

  // On (re)load, offer to resume if Spotify is already playing one of our tracks.
  useEffect(() => {
    if (!loggedIn) return;
    getPlaybackState()
      .then((snap) => {
        if (!snap?.trackUri) return;
        const idx = tracks.findIndex((t) => t.spotifyUri === snap.trackUri);
        setResumeIndex(idx >= 0 ? idx : null);
      })
      .catch(() => {});
  }, [loggedIn, tracks]);

  if (!IS_CONFIGURED) {
    return (
      <div className="screen center">
        <div className="card notice">
          <h1>Setup needed</h1>
          <p>
            No Spotify Client ID found. Copy <code>.env.example</code> to{' '}
            <code>.env</code>, paste your Client ID from the{' '}
            <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
              Spotify dashboard
            </a>
            , and restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="screen center">
        <div className="spinner" />
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginScreen error={authError} />;
  }

  return (
    <div className="screen">
      {view === 'editor' ? (
        <TrackEditor
          initial={editIndex != null ? tracks[editIndex] : null}
          library={stepLibrary}
          onSave={saveTrack}
          onDelete={editIndex != null ? deleteTrack : undefined}
          onCancel={() => setView('list')}
        />
      ) : view === 'list' ? (
        <>
          <header className="topbar">
            <h1>Tracks</h1>
            <button className="link" onClick={() => { logout(); setLoggedIn(false); }}>
              Log out
            </button>
          </header>
          {resumeIndex != null && tracks[resumeIndex] && (
            <button
              className="resume-btn primary big"
              onClick={() => openTrack(resumeIndex, true)}
            >
              ▶ Go back to your last session —{' '}
              {tracks[resumeIndex].title ??
                trackInfos[tracks[resumeIndex].spotifyUri]?.title ??
                'current track'}
            </button>
          )}
          <DevicePicker selectedDeviceId={deviceId} onSelect={setDeviceId} />
          {infosError && <p className="error">Couldn’t load track info: {infosError}</p>}
          <TrackList
            tracks={tracks}
            infos={trackInfos}
            onSelect={(i) => openTrack(i)}
            onEdit={(i) => openEditor(i)}
          />
          <button className="ghost new-routine" onClick={() => openEditor(null)}>
            + New routine
          </button>
          <RoutinesManager
            tracks={tracks}
            overridden={overridden}
            onImport={importTracks}
            onReset={resetTracks}
          />
        </>
      ) : (
        <PlayerScreen
          tracks={tracks}
          startIndex={selectedIndex}
          deviceId={deviceId}
          resume={resume}
          onBack={() => setView('list')}
          onUpdateTrack={updateTrack}
        />
      )}
    </div>
  );
}
