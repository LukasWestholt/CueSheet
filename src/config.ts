// Spotify app configuration. The Client ID comes from a gitignored .env file
// (see .env.example). It is a public identifier, not a secret.
export const SPOTIFY_CLIENT_ID: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';

// Must exactly match a Redirect URI registered in the Spotify dashboard.
// We derive it from the current origin + Vite base path so dev (127.0.0.1, base
// '/') and the GitHub Pages project deploy (base '/CueSheet/') both work.
// BASE_URL always has a trailing slash, so there's no separator before 'callback'.
export const REDIRECT_URI: string = `${window.location.origin}${import.meta.env.BASE_URL}callback`;

export const SCOPES: string[] = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  // Reads the account profile (display name + Premium status) for the
  // Premium gate. See getCurrentUser() / GET /me.
  'user-read-private',
];

export const IS_CONFIGURED: boolean =
  SPOTIFY_CLIENT_ID.length > 0 && SPOTIFY_CLIENT_ID !== 'your_spotify_client_id_here';
