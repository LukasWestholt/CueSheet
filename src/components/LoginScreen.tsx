import { beginLogin } from '../spotify/auth';

export default function LoginScreen({ error }: { error: string | null }) {
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
        <button className="primary big" onClick={() => beginLogin()}>
          Log in with Spotify
        </button>
        <p className="hint">Requires Spotify Premium for playback control.</p>
      </div>
    </div>
  );
}
