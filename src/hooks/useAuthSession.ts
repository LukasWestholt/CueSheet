import { useEffect, useState } from 'react';
import {
  AUTH_EXPIRED_EVENT,
  handleRedirectCallback,
  isLoggedIn,
  logout as spotifyLogout,
  startTokenAutoRefresh,
} from '../spotify/auth';
import { getCurrentUser, type SpotifyAccount } from '../spotify/api';

/**
 * Owns the client-side OAuth lifecycle: completes the redirect callback,
 * tracks login state, keeps the token fresh in the background, fetches the
 * account profile (for the greeting + Premium gate), and drops to the login
 * screen if a refresh fails mid-session. `onExpired` lets the caller run a
 * navigation side effect (e.g. return to the list view) on expiry; `online`
 * gates the profile fetch.
 */
export function useAuthSession({
  online = true,
  onExpired,
}: { online?: boolean; onExpired?: () => void } = {}) {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [account, setAccount] = useState<SpotifyAccount | null>(null);

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
    const handler = () => {
      setLoggedIn(false);
      setAccount(null);
      setAuthError('Your Spotify session expired — please log in again.');
      onExpired?.();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, [onExpired]);

  // Once logged in (and online), fetch the account profile for the Premium gate
  // + a greeting. Best-effort: a null result just leaves the gate inconclusive.
  useEffect(() => {
    if (!loggedIn || !online) return;
    getCurrentUser()
      .then((a) => setAccount(a))
      .catch(() => {});
  }, [loggedIn, online]);

  const logout = () => {
    spotifyLogout();
    setLoggedIn(false);
    setAccount(null);
  };

  return { ready, loggedIn, authError, account, logout };
}
