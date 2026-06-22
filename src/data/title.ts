/**
 * Trims "not important" qualifiers that Spotify appends to track titles —
 * "Radio Edit", "Extended Mix", "2011 Remaster", "Single Version", etc. — so
 * the overview list stays readable. The qualifier usually sits at the very end,
 * either after a " - " separator or inside (parentheses)/[brackets].
 *
 * A removed qualifier is replaced by an ellipsis so it's clear the title was
 * shortened (and the full title is still available via a `title` tooltip):
 *   "Titanium - Radio Edit"        → "Titanium…"
 *   "Levels (Original Mix)"        → "Levels…"
 *   "Sweet Dreams - 2018 Remaster" → "Sweet Dreams…"
 *
 * Deliberately conservative: "Remix" and "feat." segments are kept (they name a
 * genuinely different recording / credit), and only a trailing segment is ever
 * peeled — a qualifier in the middle of a title is left alone.
 */
const NOISE_RE =
  /\b(?:edit|mix|version|remaster(?:ed)?|bonus(?:\s+track)?|mono|stereo|deluxe(?:\s+edition)?|anniversary\s+edition)\b/i;

export function cleanTitle(title: string): string {
  let s = title.trim();
  let stripped = false;

  const peel = (): boolean => {
    // Trailing "(...)" or "[...]".
    const bracket = s.match(/^(.*\S)\s*[([]([^)\]]+)[)\]]\s*$/);
    if (bracket && NOISE_RE.test(bracket[2])) {
      s = bracket[1].trim();
      return true;
    }
    // Trailing " - ..." / " – ..." / " — ..." segment.
    const dash = s.match(/^(.*\S)\s+[-–—]\s+(\S.*)$/);
    if (dash && NOISE_RE.test(dash[2])) {
      s = dash[1].trim();
      return true;
    }
    return false;
  };

  while (peel()) stripped = true;
  return stripped ? `${s}…` : s;
}