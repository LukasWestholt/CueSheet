import { useCallback, useEffect, useState } from 'react';
import { IS_CONFIGURED } from './config';
import { getPlaybackState, getTracksInfo, type TrackInfo } from './spotify/api';
import { type Track } from './data/tracks';
import { parsePath, trackPath, listPath, sessionPath } from './nav/routes';
import { toast } from './data/toast';
import { DEFAULT_GAP_SECONDS } from './hooks/usePlayerEngine';
import { useOnline } from './hooks/useOnline';
import { useDeviceKeepAwake } from './hooks/useDeviceKeepAwake';
import { useAuthSession } from './hooks/useAuthSession';
import { useRoutineSources } from './hooks/useRoutineSources';
import { useFavorites } from './hooks/useFavorites';
import { useSetlist } from './hooks/useSetlist';
import LoginScreen from './components/LoginScreen';
import SiteFooter from './components/SiteFooter';
import ListScreen from './components/ListScreen';
import PlayerScreen from './components/PlayerScreen';
import TrackEditor from './components/TrackEditor';
import PlaylistSeed from './components/PlaylistSeed';
import Toaster from './components/Toaster';
import { ingestGetsongbpmKeyFromUrl } from './data/getsongbpmKey';

// Apply a `?getsongbpm_key=…` bookmark before React renders (strips the param).
ingestGetsongbpmKeyFromUrl();

type View = 'list' | 'player' | 'editor' | 'seed';
type PlayerMode = 'start' | 'resume' | 'view';

const BASE = import.meta.env.BASE_URL;

export default function App() {
  const online = useOnline();
  const [view, setView] = useState<View>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playerMode, setPlayerMode] = useState<PlayerMode>('start');
  // A track id from a deep link (/track/:id) waiting for the list to load.
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(() => {
    const r = parsePath(window.location.pathname, BASE);
    return r.name === 'track' ? r.id : null;
  });
  // Setlist ids from a deep link (/session/a,b,c — a shared class plan) waiting
  // for the routine list. Empty array = the bare /session (saved setlist).
  const [pendingSessionIds, setPendingSessionIds] = useState<string[] | null>(() => {
    const r = parsePath(window.location.pathname, BASE);
    return r.name === 'session' ? r.ids : null;
  });
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [trackInfos, setTrackInfos] = useState<Record<string, TrackInfo>>({});
  const [infosError, setInfosError] = useState<string | null>(null);
  // Index of one of our tracks that Spotify is already playing (e.g. after a reload).
  const [resumeIndex, setResumeIndex] = useState<number | null>(null);
  // When view === 'editor': index of the track being edited, or null for a new one.
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState(false);

  // Reset navigation selection when the active routine list is fully replaced.
  const resetSelection = useCallback(() => {
    setSelectedIndex(0);
    setResumeIndex(null);
  }, []);
  const goToList = useCallback(() => setView('list'), []);

  const { ready, loggedIn, authError, account, logout } = useAuthSession({
    online,
    onExpired: goToList,
  });
  const {
    tracks,
    stepLibrary,
    sourceRows,
    commitTracks,
    updateTrack,
    toggleSource,
    addCustomFile,
    removeCustomFile,
    resetTracks,
  } = useRoutineSources({ onListReplaced: resetSelection });
  const { favorites, toggleFavorite } = useFavorites();
  const setlist = useSetlist(tracks);

  // Keep the playback device awake on the non-player screens (list/editor/seed)
  // so it's ready before the first track. The player view owns the device itself.
  useDeviceKeepAwake(deviceId, loggedIn && online && view !== 'player');

  const startSession = () => {
    if (setlist.sessionTracks.length === 0) return;
    setSessionActive(true);
    setPlayerMode('start');
    setView('player');
    // The session URL is its ordered id list — reload-safe and shareable.
    window.history.pushState(
      {},
      '',
      sessionPath(setlist.sessionTracks.map((t) => t.id), BASE),
    );
  };

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

  const openEditor = (index: number | null) => {
    setEditIndex(index);
    setView('editor');
  };
  const saveTrack = (track: Track) => {
    const next =
      editIndex == null ? [...tracks, track] : tracks.map((t, i) => (i === editIndex ? track : t));
    commitTracks(next);
    setView('list');
  };
  const deleteTrack = () => {
    if (editIndex == null) return;
    commitTracks(tracks.filter((_, i) => i !== editIndex));
    setView('list');
  };
  const seedTracks = (stubs: Track[]) => {
    commitTracks([...tracks, ...stubs]);
    setView('list');
  };

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

  // After the OAuth round-trip the callback restores the deep link the user
  // came from (auth.ts) — the mount-time parse only saw /callback, so re-parse
  // once the session is ready.
  useEffect(() => {
    if (!ready) return;
    const r = parsePath(window.location.pathname, BASE);
    if (r.name === 'track') setPendingTrackId(r.id);
    else if (r.name === 'session') setPendingSessionIds(r.ids);
  }, [ready]);

  // Resolve a deep link (/track/:id) once logged in and the routine list has
  // loaded. Opens the track's detail page in 'view' mode (quiet, not playing).
  useEffect(() => {
    if (!loggedIn || !pendingTrackId) return;
    const i = tracks.findIndex((t) => t.id === pendingTrackId);
    if (i >= 0) {
      setSelectedIndex(i);
      setPlayerMode('view');
      setView('player');
      setPendingTrackId(null);
    }
  }, [loggedIn, pendingTrackId, tracks]);

  // Resolve a session deep link once the routine list is loaded. A shared id
  // list (/session/a,b,c) is imported into the setlist (skipping unknown ids,
  // with a toast); the bare /session (PWA shortcut) uses the saved setlist.
  // Opens the session player in 'view' mode — positioned, Play to start.
  // Gated on login: importing must not run (or pop its confirm) behind the
  // login screen — the pending ids wait until the user is in.
  useEffect(() => {
    if (!loggedIn || !pendingSessionIds || tracks.length === 0) return;
    const shared = pendingSessionIds.length > 0;
    const wanted = shared ? pendingSessionIds : setlist.setlist;
    const known = wanted.filter((id) => tracks.some((t) => t.id === id));
    setPendingSessionIds(null);
    if (known.length === 0) {
      if (shared) toast('None of the shared setlist tracks are in your routines.');
      return;
    }
    if (shared) {
      // Importing overwrites the coach's own saved setlist — confirm first.
      const ok = window.confirm(
        `Load the shared setlist (${known.length} tracks)? It replaces your current setlist.`,
      );
      if (!ok) return; // pending already cleared — stay on the list
      setlist.replace(known);
      if (known.length < wanted.length) {
        toast(
          `${wanted.length - known.length} of ${wanted.length} shared setlist tracks ` +
            "aren't in your routines and were skipped.",
        );
      }
    }
    setSessionActive(true);
    setPlayerMode('view');
    setView('player');
  }, [loggedIn, pendingSessionIds, tracks, setlist]);

  // Land at the top whenever the screen changes (open a track, go back to the
  // list, enter the editor) — a deep-linked or re-opened view shouldn't inherit
  // the previous screen's scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, selectedIndex]);

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
      <div className="screen center-col">
        <div className="center-fill">
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
        <SiteFooter />
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="screen center-col">
        <div className="center-fill">
          <div className="spinner" />
        </div>
        <SiteFooter />
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
        <ListScreen
          tracks={tracks}
          trackInfos={trackInfos}
          online={online}
          infosError={infosError}
          account={account}
          resumeIndex={resumeIndex}
          onOpenTrack={openTrack}
          onLogout={logout}
          deviceId={deviceId}
          onSelectDevice={setDeviceId}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          setlist={setlist}
          onStartSession={startSession}
          onEdit={openEditor}
          onNew={() => openEditor(null)}
          onSeed={() => setView('seed')}
          sourceRows={sourceRows}
          onToggleSource={toggleSource}
          onAddCustom={addCustomFile}
          onRemoveCustom={removeCustomFile}
          onReset={resetTracks}
        />
      ) : (
        <PlayerScreen
          tracks={sessionActive ? setlist.sessionTracks : tracks}
          startIndex={sessionActive ? 0 : selectedIndex}
          deviceId={deviceId}
          mode={playerMode}
          session={
            sessionActive
              ? {
                  durationsMs: setlist.sessionTracks.map(
                    (t) => t.durationMs ?? trackInfos[t.spotifyUri]?.durationMs ?? 0,
                  ),
                  gapSeconds: DEFAULT_GAP_SECONDS,
                }
              : undefined
          }
          onBack={goList}
          onUpdateTrack={(_i, t) => updateTrack(t)}
          onEdit={(id) => {
            const i = tracks.findIndex((t) => t.id === id);
            if (i >= 0) openEditor(i);
          }}
        />
      )}
      <SiteFooter />
    </div>
  );
}
