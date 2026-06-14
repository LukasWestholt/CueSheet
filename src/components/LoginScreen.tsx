import { beginLogin } from '../spotify/auth';

export default function LoginScreen({
  error,
  offline = false,
}: {
  error: string | null;
  offline?: boolean;
}) {
  return (
    <div className="screen center">
      <div className="card login">
        <div className="logo">🤾</div>
        <h1>CueSheet</h1>
        <p className="muted">
          CueSheet turns your Spotify playlist into a timed cue sheet, calling
          each jumping-fitness step in time with the music.
        </p>
        {error && <p className="error">{error}</p>}
        {offline && <p className="error">You’re offline — connect to log in.</p>}
        <button className="primary big" onClick={() => beginLogin()} disabled={offline}>
          Log in with Spotify
        </button>
        <p className="hint">Requires Spotify Premium for playback control.</p>
      </div>
    </div>
  );
}
