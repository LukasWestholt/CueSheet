import { useState } from 'react';
import { readFlag, writeFlag } from '../data/storage';

// One-time dismissible storage notice. The app stores only strictly-necessary
// functional data (Spotify tokens + preferences) in localStorage — no tracking
// or third-party cookies — so this is an informational notice, not a consent
// gate. Dismissal is remembered (same convention as the install prompt's
// tjf.installDismissed). "Details" opens the full Impressum/privacy modal.
const KEY = 'tjf.storageNoticeDismissed';

export default function CookieNotice({ onLearnMore }: { onLearnMore: () => void }) {
  const [dismissed, setDismissed] = useState(() => readFlag(KEY));
  if (dismissed) return null;

  const dismiss = () => {
    writeFlag(KEY, true);
    setDismissed(true);
  };

  return (
    <div className="storage-notice" role="region" aria-label="Storage notice">
      <p>
        CueSheet stores data only on your device — your Spotify login and preferences — to
        make the app work. No tracking, no analytics, no third-party cookies.{' '}
        <button type="button" className="link" onClick={onLearnMore}>
          Details
        </button>
      </p>
      <button type="button" className="primary" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
