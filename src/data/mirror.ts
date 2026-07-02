// Mirrored calling: the coach faces the class, so the coach's left is the
// class's right. When the mirror toggle is on, left/right words in step names
// and cues are swapped for display (English + German, plus bare L/R markers) —
// the coach reads the mirrored cue and calls it as-is. Display-only: the
// routine data and the derived timeline are untouched.

const SWAPS: Record<string, string> = {
  left: 'right',
  right: 'left',
  links: 'rechts',
  rechts: 'links',
  l: 'r',
  r: 'l',
};

/** Swap one matched word, preserving ALL-CAPS / Capitalised / lower casing. */
function swapWord(word: string): string {
  const swap = SWAPS[word.toLowerCase()];
  if (!swap) return word;
  if (word === word.toUpperCase()) return swap.toUpperCase();
  if (word[0] === word[0].toUpperCase()) return swap[0].toUpperCase() + swap.slice(1);
  return swap;
}

/** Mirror the left/right words in a cue or step name. */
export function mirrorCue(text: string): string {
  return text.replace(/[A-Za-zÄÖÜäöüß]+/g, swapWord);
}
