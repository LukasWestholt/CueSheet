import { useCallback, useRef, useState, type MutableRefObject } from 'react';

/**
 * State that also exposes a ref kept in lock-step with it. The setter updates
 * the ref *synchronously* before the re-render, so callbacks/timers can read the
 * latest value via `ref.current` without being torn down on every change.
 *
 * This removes the error-prone "always pair `setX(v)` with `xRef.current = v`"
 * pattern (see `usePlayerEngine`): there's now a single setter that does both.
 */
export function useStateRef<T>(
  initial: T,
): [T, (value: T) => void, MutableRefObject<T>] {
  const [value, setValue] = useState(initial);
  const ref = useRef(value);
  const set = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
  }, []);
  return [value, set, ref];
}
