// Client-side Authorization Code + PKCE flow.
// No backend and no client secret required — suitable for a static PWA.
import { SPOTIFY_CLIENT_ID, REDIRECT_URI, SCOPES } from '../config';

const TOKEN_KEY = 'tjf.spotify.tokens';
const VERIFIER_KEY = 'tjf.spotify.verifier';
const AUTH_BASE = 'https://accounts.spotify.com';

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms (already includes a safety margin)
}

function base64url(bytes: ArrayBuffer): string {
  let str = '';
  const arr = new Uint8Array(bytes);
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
}

function randomVerifier(length = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function getTokens(): StoredTokens | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

function storeTokens(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}): void {
  const existing = getTokens();
  const tokens: StoredTokens = {
    access_token: data.access_token,
    // Spotify omits refresh_token on refresh responses — keep the old one.
    refresh_token: data.refresh_token ?? existing?.refresh_token ?? '',
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function isLoggedIn(): boolean {
  return getTokens() !== null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Redirects the browser to Spotify's consent screen. */
export async function beginLogin(): Promise<void> {
  const verifier = randomVerifier();
  localStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = base64url(await sha256(verifier));

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `${AUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Completes the flow on the /callback route. Exchanges the code for tokens,
 * cleans the URL, and returns true on success.
 */
export async function handleRedirectCallback(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) throw new Error(`Spotify authorization failed: ${error}`);
  if (!code) return false;

  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error('Missing PKCE verifier — please log in again.');

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch(`${AUTH_BASE}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);

  storeTokens(await res.json());
  localStorage.removeItem(VERIFIER_KEY);
  // Drop ?code=... from the address bar.
  window.history.replaceState({}, '', '/');
  return true;
}

/** Returns a valid access token, refreshing transparently when needed. */
export async function getAccessToken(): Promise<string> {
  const tokens = getTokens();
  if (!tokens) throw new Error('Not logged in');
  if (Date.now() < tokens.expires_at) return tokens.access_token;

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  });
  const res = await fetch(`${AUTH_BASE}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    logout();
    throw new Error('Session expired — please log in again.');
  }
  const data = await res.json();
  storeTokens(data);
  return data.access_token as string;
}
