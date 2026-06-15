import { beginLogin } from '../spotify/auth';
import { REPO_URL, ISSUES_URL, KOFI_URL } from '../links';

// The pre-login landing page: what CueSheet does, what it costs, and the login
// call-to-action. Shown whenever the user isn't logged in.

const FEATURES: { title: string; body: string }[] = [
  {
    title: 'Synced cue display',
    body: 'A big NOW / NEXT move with a beat-synced count-in — readable from the trampoline while you jump.',
  },
  {
    title: 'Author routines musically',
    body: 'Build step lists in 8-counts (measures) + BPM, not seconds. In-app editor with tap-tempo, tap-to-time and a move library.',
  },
  {
    title: 'Hands-off between tracks',
    body: 'A 20-second auto-gap auto-advances to the next song, or pause permanently between tracks with one tap.',
  },
  {
    title: 'Plays on your speaker',
    body: 'Remote-controls Spotify on a separate device (e.g. a tablet → Bluetooth speaker), with a sync-offset slider for audio latency.',
  },
  {
    title: 'Works offline',
    body: 'Installable PWA — the track list, editor and authored callings keep working without a connection. Import/export routines as JSON.',
  },
  {
    title: 'Resilient in class',
    body: 'Recovers when the playback device drops off or another app hijacks it, and re-auths gracefully if your session expires.',
  },
];

export default function LoginScreen({
  error,
  offline = false,
}: {
  error: string | null;
  offline?: boolean;
}) {
  return (
    <div className="screen landing">
      <div className="landing-inner">
        <header className="landing-hero">
          <div className="logo">🤾</div>
          <h1>CueSheet</h1>
          <p className="lead">
            CueSheet turns your Spotify playlist into a timed cue sheet, calling each
            jumping-fitness step in time with the music.
          </p>
          {error && <p className="error">{error}</p>}
          {offline && <p className="error">You’re offline — connect to log in.</p>}
          <button className="primary big" onClick={() => beginLogin()} disabled={offline}>
            Log in with Spotify
          </button>
          <p className="hint">Requires Spotify Premium on the device that plays the audio.</p>
        </header>

        <section className="landing-section">
          <h2>What it does</h2>
          <ul className="feature-list">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="feature-title">{f.title}</span>
                <span className="feature-body">{f.body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section">
          <h2>What it costs</h2>
          <p>
            CueSheet is <strong>free and open source</strong>. It has no backend of its own —
            it runs entirely in your browser and remote-controls Spotify — so there’s nothing
            to subscribe to and no per-user cost to run it.
          </p>
          <ul className="cost-list">
            <li>
              You need <strong>Spotify Premium</strong> on the device that plays the audio —
              that’s Spotify’s requirement for remote playback control, not a CueSheet charge.
            </li>
            <li>It’s served as a static site, so hosting is negligible.</li>
          </ul>
          <p>If it earns its place in your classes, you can chip in toward development:</p>
          <a className="kofi-btn" href={KOFI_URL} target="_blank" rel="noreferrer">
            ☕ Support on Ko-fi
          </a>
        </section>

        <footer className="landing-footer">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source code
          </a>
          <a href={ISSUES_URL} target="_blank" rel="noreferrer">
            Report an issue
          </a>
          <a href={KOFI_URL} target="_blank" rel="noreferrer">
            Ko-fi
          </a>
        </footer>
      </div>
    </div>
  );
}
