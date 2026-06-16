import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copies text to the clipboard and flips a "copied" flag true for `ms` so a
 * button can flash confirmation. Clipboard failures are swallowed (it may be
 * unavailable outside a secure context). Returns `[copied, copy]`.
 */
export function useCopyFlag(ms = 1500): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), ms);
      } catch {
        /* clipboard may be unavailable */
      }
    },
    [ms],
  );

  return [copied, copy];
}
