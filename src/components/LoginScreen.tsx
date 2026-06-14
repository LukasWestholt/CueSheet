import { beginLogin } from '../spotify/auth';

export default function LoginScreen({ error }: { error: string | null }) {
  return (
    <div className="screen center">
      <div className="card login">
        <div className="logo">🤾</div>
        <h1>Teach Jumping Fitness</h1>
        <p className="muted">
          Connect Spotify to control the music on your tablet/speaker and see your
          prepared step callings synced to the track.
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
