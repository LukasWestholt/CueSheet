import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { readFlag, writeFlag } from '../data/storage';

const DISMISS_KEY = 'tjf.installDismissed';

/**
 * A dismissible "install this app" banner. Shows a one-tap Install on
 * Android/desktop, or "Add to Home Screen" guidance on iOS. Hidden once
 * installed or after the user dismisses it (remembered in localStorage).
 */
export default function InstallPrompt() {
  const { canInstall, iosHint, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISS_KEY));

  if (dismissed || (!canInstall && !iosHint)) return null;

  const dismiss = () => {
    writeFlag(DISMISS_KEY, true);
    setDismissed(true);
  };

  return (
    <div className="install-banner">
      <span className="install-text">
        {canInstall
          ? 'Install CueSheet for full-screen, offline use.'
          : 'Install: tap the Share button, then “Add to Home Screen”.'}
      </span>
      <div className="install-actions">
        {canInstall && (
          <button className="primary" onClick={promptInstall}>
            Install
          </button>
        )}
        <button className="link" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
