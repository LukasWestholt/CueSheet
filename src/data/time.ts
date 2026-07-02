// Shared playback-time formatters. Everything in the app measures time in
// milliseconds, so these take ms (callers holding seconds multiply by 1000).

/** `m:ss` — the common track/position clock (e.g. 215000 → "3:35"). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Wall-clock time of day (locale HH:MM) — for "class ends at 18:45" labels.
 * locale/timeZone params exist for deterministic tests; callers omit them.
 */
export function formatTimeOfDay(epochMs: number, locale?: string, timeZone?: string): string {
  return new Date(epochMs).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

/** `h:mm:ss` (hours field only when needed) — for long session totals. */
export function formatLong(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${s.toString().padStart(2, '0')}`;
}
