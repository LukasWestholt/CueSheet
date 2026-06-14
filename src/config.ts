// Spotify app configuration. The Client ID comes from a gitignored .env file
// (see .env.example). It is a public identifier, not a secret.
export const SPOTIFY_CLIENT_ID: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';

// Must exactly match a Redirect URI registered in the Spotify dashboard.
// We derive it from the current origin so dev (127.0.0.1) and prod both work.
export const REDIRECT_URI: string = `${window.location.origin}/callback`;

export const SCOPES: string[] = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
];

export const IS_CONFIGURED: boolean =
  SPOTIFY_CLIENT_ID.length > 0 && SPOTIFY_CLIENT_ID !== 'your_spotify_client_id_here';
