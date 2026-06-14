import { useEffect, useState } from 'react';
import { IS_CONFIGURED } from './config';
import { handleRedirectCallback, isLoggedIn, logout } from './spotify/auth';
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
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

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
          <DevicePicker selectedDeviceId={deviceId} onSelect={setDeviceId} />
          <TrackList
            tracks={TRACKS}
            onSelect={(i) => {
              setSelectedIndex(i);
              setView('player');
            }}
          />
        </>
      ) : (
        <PlayerScreen
          tracks={TRACKS}
          startIndex={selectedIndex}
          deviceId={deviceId}
          onBack={() => setView('list')}
        />
      )}
    </div>
  );
}
