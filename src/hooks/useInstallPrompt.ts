import { useEffect, useState } from 'react';

// Minimal shape of the (non-standard) beforeinstallprompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes navigator.standalone when launched from the home screen.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export interface InstallPrompt {
  /** Android/desktop: a deferred prompt is available — show an Install button. */
  canInstall: boolean;
  /** iOS Safari has no programmatic prompt — show "Add to Home Screen" guidance. */
  iosHint: boolean;
  /** Already running as an installed PWA. */
  installed: boolean;
  /** Fire the native install prompt (no-op when canInstall is false). */
  promptInstall: () => Promise<void>;
}

/**
 * Captures the browser's deferred install prompt and exposes a one-tap install.
 * On iOS (no `beforeinstallprompt`) it instead flags that manual "Add to Home
 * Screen" guidance should be shown. Returns `installed` once running standalone.
 */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's default mini-infobar; we drive it ourselves
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null); // a prompt can only be used once
  };

  return {
    canInstall: !installed && deferred !== null,
    iosHint: !installed && deferred === null && isIos(),
    installed,
    promptInstall,
  };
}
