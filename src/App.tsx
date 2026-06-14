import { useEffect, useState } from 'react';
import { IS_CONFIGURED } from './config';
import { handleRedirectCallback, isLoggedIn, logout } from './spotify/auth';
import { getPlaybackState, getTracksInfo, type TrackInfo } from './spotify/api';
import { TRACKS } from './data/tracks';
import LoginScreen from './components/LoginScreen';
import TrackList from './components/TrackList';
import PlayerScreen from './components/PlayerScreen';
import DevicePicker from './components/DevicePicker';

type View = 'list' | 'player';

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

  const openTrack = (index: number, asResume = false) => {
    setSelectedIndex(index);
    setResume(asResume);
    setView('player');
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
    getTracksInfo(TRACKS.map((t) => t.spotifyUri))
      .then((infos) => {
        setTrackInfos(infos);
        setInfosError(null);
      })
      .catch((e) => setInfosError(e instanceof Error ? e.message : String(e)));
  }, [loggedIn]);

  // On (re)load, offer to resume if Spotify is already playing one of our tracks.
  useEffect(() => {
    if (!loggedIn) return;
    getPlaybackState()
      .then((snap) => {
        if (!snap?.trackUri) return;
        const idx = TRACKS.findIndex((t) => t.spotifyUri === snap.trackUri);
        setResumeIndex(idx >= 0 ? idx : null);
      })
      .catch(() => {});
  }, [loggedIn]);

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
      {view === 'list' ? (
        <>
          <header className="topbar">
            <h1>Tracks</h1>
            <button className="link" onClick={() => { logout(); setLoggedIn(false); }}>
              Log out
            </button>
          </header>
          {resumeIndex != null && (
            <button
              className="resume-btn primary big"
              onClick={() => openTrack(resumeIndex, true)}
            >
              ▶ Go back to your last session —{' '}
              {TRACKS[resumeIndex].title ??
                trackInfos[TRACKS[resumeIndex].spotifyUri]?.title ??
                'current track'}
            </button>
          )}
          <DevicePicker selectedDeviceId={deviceId} onSelect={setDeviceId} />
          {infosError && <p className="error">Couldn’t load track info: {infosError}</p>}
          <TrackList tracks={TRACKS} infos={trackInfos} onSelect={(i) => openTrack(i)} />
        </>
      ) : (
        <PlayerScreen
          tracks={TRACKS}
          startIndex={selectedIndex}
          deviceId={deviceId}
          resume={resume}
          onBack={() => setView('list')}
        />
      )}
    </div>
  );
}
