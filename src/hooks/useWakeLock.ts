import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps the screen awake during a class via the Screen Wake Lock API
 * (iOS Safari 16.4+, Android Chrome). Re-acquires automatically when the
 * tab becomes visible again. Returns whether the lock is currently held.
 */
export function useWakeLock(enabled: boolean): boolean {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const [active, setActive] = useState(false);

  const acquire = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener('release', () => setActive(false));
    } catch {
      setActive(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
      setActive(false);
      return;
    }

    acquire();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [enabled, acquire]);

  return active;
}
