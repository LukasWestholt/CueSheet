import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

// Dev-only: `?preview` renders the no-auth design preview of the player UI (see
// PlayerPreview), so the coaching screen can be checked on a phone over LAN
// where the loopback-only redirect URI can't complete login. The DEV guard is
// statically false in production, so this branch — and the dynamic import — are
// dead-code-eliminated and PlayerPreview never ships in the prod bundle.
const usePreview =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('preview');

if (usePreview) {
  void import('./components/PlayerPreview').then(({ default: PlayerPreview }) =>
    root.render(
      <StrictMode>
        <PlayerPreview />
      </StrictMode>,
    ),
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
