import { useEffect, useRef } from 'react';

/**
 * Vibrate briefly when the active step changes (Vibration API — Android
 * Chrome; iOS Safari doesn't support it, so callers hide the toggle there).
 * Only a live transition buzzes: the initial row (mounting into a track) is
 * swallowed, and row -1 (before the first calling) never buzzes.
 */
export function useHapticCue(activeRow: number, enabled: boolean): void {
  const lastRef = useRef(activeRow);
  useEffect(() => {
    const prev = lastRef.current;
    lastRef.current = activeRow;
    if (!enabled || activeRow === prev || activeRow < 0) return;
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    navigator.vibrate(80);
  }, [activeRow, enabled]);
}
