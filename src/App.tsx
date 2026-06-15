import { useEffect, useMemo, useRef, useState } from 'react';
import { IS_CONFIGURED } from './config';
import {
  AUTH_EXPIRED_EVENT,
  handleRedirectCallback,
  isLoggedIn,
  logout,
  startTokenAutoRefresh,
} from './spotify/auth';
import { getPlaybackState, getTracksInfo, type TrackInfo } from './spotify/api';
import { TRACKS, type Track } from './data/tracks';
import { clearStoredTracks, loadStoredTracks, saveStoredTracks } from './data/tracksStore';
import { validateTracks, type ValidationResult } from './data/validateTracks';
import {
  loadRecommendedRoutines,
  loadDefaultRoutines,
  fetchRoutineFile,
  type RecommendedRoutine,
} from './data/recommendedImports';
import { collectStepLibrary } from './data/stepLibrary';
import { parsePath, trackPath, listPath } from './nav/routes';
import { APP_VERSION } from './version';
import { loadFavorites, saveFavorites } from './data/favorites';
import { loadSetlist, saveSetlist } from './data/setlistStore';
import { resolveSetlist } from './data/setlist';
import { DEFAULT_GAP_SECONDS } from './hooks/usePlayerEngine';
import { useOnline } from './hooks/useOnline';
import LoginScreen from './components/LoginScreen';
import TrackList from './components/TrackList';
import PlayerScreen from './components/PlayerScreen';
import DevicePicker from './components/DevicePicker';
import RoutinesManager from './components/RoutinesManager';
import TrackEditor from './components/TrackEditor';
import PlaylistSeed from './components/PlaylistSeed';
import InstallPrompt from './components/InstallPrompt';
import SetlistPanel from './components/SetlistPanel';
import Settings from './components/Settings';
import Toaster from './components/Toaster';
import { ingestGetsongbpmKeyFromUrl } from './data/getsongbpmKey';

// Apply a `?getsongbpm_key=…` bookmark before React renders (strips the param).
ingestGetsongbpmKeyFromUrl();

/** Use a valid stored override if present, else the code-defined routines. */
function initialTracks(): { tracks: Track[]; overridden: boolean } {
  const stored = loadStoredTracks();
  if (stored && validateTracks(stored).ok) return { tracks: stored, overridden: true };
  return { tracks: TRACKS, overridden: false };
}

type View = 'list' | 'player' | 'editor' | 'seed';
type PlayerMode = 'start' | 'resume' | 'view';

const BASE = import.meta.env.BASE_URL;

export default function App() {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<View>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playerMode, setPlayerMode] = useState<PlayerMode>('start');
  // A track id from a deep link (/track/:id) waiting for the list to load.
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(() => {
    const r = parsePath(window.location.pathname, BASE);
    return r.name === 'track' ? r.id : null;
  });
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

  // Track-list search + favorites.
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const toggleFavorite = (id: string) =>
    setFavorites((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });

  // Setlist (session queue): an ordered list of track ids, persisted.
  const [setlist, setSetlist] = useState<string[]>(loadSetlist);
  const [sessionActive, setSessionActive] = useState(false);
  const persistSetlist = (next: string[]) => {
    saveSetlist(next);
    setSetlist(next);
  };
  const toggleSetlist = (id: string) =>
    persistSetlist(setlist.includes(id) ? setlist.filter((x) => x !== id) : [...setlist, id]);
  const moveSetlist = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= setlist.length) return;
    const next = setlist.slice();
    [next[index], next[j]] = [next[j], next[index]];
    persistSetlist(next);
  };
  const removeSetlist = (id: string) => persistSetlist(setlist.filter((x) => x !== id));
  const clearSetlist = () => persistSetlist([]);
  // Drop ids that no longer exist (e.g. after a routine reset/import).
  const setlistSet = useMemo(() => new Set(setlist), [setlist]);
  const sessionTracks = useMemo(() => resolveSetlist(setlist, tracks), [setlist, tracks]);
  const startSession = () => {
    if (sessionTracks.length === 0) return;
    setSessionActive(true);
    setView('player');
    window.history.pushState({}, '', listPath(BASE)); // a session has no per-track URL
  };

  const visibleTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => {
        if (favoritesOnly && !favorites.has(track.id)) return false;
        if (!q) return true;
        const info = trackInfos[track.spotifyUri];
        const title = (track.title ?? info?.title ?? '').toLowerCase();
        const artist = (track.artist ?? info?.artist ?? '').toLowerCase();
        return title.includes(q) || artist.includes(q);
      });
  }, [tracks, query, favoritesOnly, favorites, trackInfos]);

  const openTrack = (index: number, asResume = false) => {
    setSessionActive(false);
    setSelectedIndex(index);
    setPlayerMode(asResume ? 'resume' : 'start');
    setView('player');
    const id = tracks[index]?.id;
    if (id) window.history.pushState({}, '', trackPath(id, BASE));
  };
  // Back to the list, keeping the URL in sync.
  const goList = () => {
    setSessionActive(false);
    setView('list');
    window.history.pushState({}, '', listPath(BASE));
  };

  const persistTracks = (next: Track[], overrideOff = false) => {
    if (overrideOff) clearStoredTracks();
    else saveStoredTracks(next);
    setTrackState({ tracks: next, overridden: !overrideOff });
    setSelectedIndex(0);
    setResumeIndex(null);
  };
  const importTracks = (next: Track[]) => persistTracks(next);
  // Reset drops the user override and reloads the public-folder defaults
  // (default*.json), falling back to the built-in code tracks if none load.
  const resetTracks = () => {
    clearStoredTracks();
    loadDefaultRoutines().then((defs) => {
      setTrackState({ tracks: defs.length ? defs : TRACKS, overridden: false });
      setSelectedIndex(0);
      setResumeIndex(null);
    });
  };

  // Update a single track in place (tap-to-time). Matched by id, not index, so it
  // works whether the player is showing the full list or a setlist session.
  const updateTrack = (_index: number, updated: Track) => {
    const next = tracks.map((t) => (t.id === updated.id ? updated : t));
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
  const seedTracks = (stubs: Track[]) => {
    persistTracks([...tracks, ...stubs]);
    setView('list');
  };

  // Routine files shipped in the web server's public folder (see public/routines.json).
  const [recommended, setRecommended] = useState<RecommendedRoutine[]>([]);
  const overriddenAtMount = useRef(overridden);
  useEffect(() => {
    loadRecommendedRoutines().then(setRecommended).catch(() => {});
    // Without a user override, the public-folder default*.json files become the
    // base routine set (replacing the built-in code tracks) when present.
    if (!overriddenAtMount.current) {
      loadDefaultRoutines().then((defs) => {
        if (defs.length) {
          setTrackState({ tracks: defs, overridden: false });
          setSelectedIndex(0);
          setResumeIndex(null);
        }
      });
    }
  }, []);
  const importFromFile = async (file: string): Promise<ValidationResult> => {
    const data = await fetchRoutineFile(file);
    const res = validateTracks(data);
    if (res.ok) importTracks(data as Track[]);
    return res;
  };

  // Handle the OAuth redirect, then determine login state.
  useEffect(() => {
    (async () => {
      try {
        if (window.location.pathname === `${import.meta.env.BASE_URL}callback`) {
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

  // Keep the access token fresh in the background while logged in.
  useEffect(() => {
    if (!loggedIn) return;
    return startTokenAutoRefresh();
  }, [loggedIn]);

  // If a token refresh fails mid-session, drop to login with a clear message.
  useEffect(() => {
    const onExpired = () => {
      setLoggedIn(false);
      setAuthError('Your Spotify session expired — please log in again.');
      setView('list');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  // Once logged in (and online), fetch list metadata (titles/durations).
  useEffect(() => {
    if (!loggedIn || !online) return;
    getTracksInfo(tracks.map((t) => t.spotifyUri))
      .then((infos) => {
        setTrackInfos(infos);
        setInfosError(null);
      })
      .catch((e) => setInfosError(e instanceof Error ? e.message : String(e)));
  }, [loggedIn, tracks, online]);

  // On (re)load, offer to resume if Spotify is already playing one of our tracks.
  useEffect(() => {
    if (!loggedIn || !online) return;
    getPlaybackState()
      .then((snap) => {
        if (!snap?.trackUri) return;
        const idx = tracks.findIndex((t) => t.spotifyUri === snap.trackUri);
        setResumeIndex(idx >= 0 ? idx : null);
      })
      .catch(() => {});
  }, [loggedIn, tracks, online]);

  // Resolve a deep link (/track/:id) once the routine list has loaded. Opens the
  // track's detail page in 'view' mode (shown quietly, not auto-played).
  useEffect(() => {
    if (!pendingTrackId) return;
    const i = tracks.findIndex((t) => t.id === pendingTrackId);
    if (i >= 0) {
      setSelectedIndex(i);
      setPlayerMode('view');
      setView('player');
      setPendingTrackId(null);
    }
  }, [pendingTrackId, tracks]);

  // Keep the view in sync with browser back/forward (no pushState here).
  useEffect(() => {
    const onPop = () => {
      setSessionActive(false);
      const r = parsePath(window.location.pathname, BASE);
      if (r.name === 'track') {
        const i = tracks.findIndex((t) => t.id === r.id);
        if (i >= 0) {
          setSelectedIndex(i);
          setPlayerMode('view');
          setView('player');
          return;
        }
      }
      setView('list');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [tracks]);

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
    return <LoginScreen error={authError} offline={!online} />;
  }

  return (
    <div className="screen">
      <Toaster />
      {!online && (
        <div className="offline-banner">
          Offline — routines are viewable, but Spotify playback, search and login need a
          connection.
        </div>
      )}
      {view === 'editor' ? (
        <TrackEditor
          initial={editIndex != null ? tracks[editIndex] : null}
          library={stepLibrary}
          onSave={saveTrack}
          onDelete={editIndex != null ? deleteTrack : undefined}
          onCancel={() => setView('list')}
        />
      ) : view === 'seed' ? (
        <PlaylistSeed
          existingUris={new Set(tracks.map((t) => t.spotifyUri))}
          onAdd={seedTracks}
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
          <InstallPrompt />
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
          {infosError && online && (
            <p className="error">Couldn’t load track info: {infosError}</p>
          )}
          <div className="list-toolbar">
            <input
              className="search-input"
              type="search"
              value={query}
              placeholder="Search title or artist…"
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className={`chip ${favoritesOnly ? 'chip-active' : ''}`}
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((v) => !v)}
            >
              ★ {favorites.size}
            </button>
          </div>
          <TrackList
            items={visibleTracks}
            infos={trackInfos}
            favorites={favorites}
            setlist={setlistSet}
            onSelect={(i) => openTrack(i)}
            onEdit={(i) => openEditor(i)}
            onToggleFavorite={toggleFavorite}
            onToggleSetlist={toggleSetlist}
          />
          <SetlistPanel
            tracks={sessionTracks}
            infos={trackInfos}
            onMove={moveSetlist}
            onRemove={removeSetlist}
            onClear={clearSetlist}
            onStart={startSession}
          />
          <div className="new-routine-row">
            <button className="ghost" onClick={() => openEditor(null)}>
              + New routine
            </button>
            <button className="ghost" onClick={() => setView('seed')}>
              Seed from playlist
            </button>
          </div>
          <RoutinesManager
            tracks={tracks}
            overridden={overridden}
            onImport={importTracks}
            onReset={resetTracks}
            recommended={recommended}
            onImportFile={importFromFile}
          />
          <Settings />
          <p className="app-version">CueSheet v{APP_VERSION}</p>
        </>
      ) : (
        <PlayerScreen
          tracks={sessionActive ? sessionTracks : tracks}
          startIndex={sessionActive ? 0 : selectedIndex}
          deviceId={deviceId}
          mode={sessionActive ? 'start' : playerMode}
          session={
            sessionActive
              ? {
                  durationsMs: sessionTracks.map(
                    (t) => t.durationMs ?? trackInfos[t.spotifyUri]?.durationMs ?? 0,
                  ),
                  gapSeconds: DEFAULT_GAP_SECONDS,
                }
              : undefined
          }
          onBack={goList}
          onUpdateTrack={updateTrack}
        />
      )}
    </div>
  );
}
