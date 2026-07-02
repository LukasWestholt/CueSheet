// Section colours for the coach timeline. The `cue` field is used in practice
// as a section label ("intro" / "chorus" / "verse" …), so equal labels get the
// same colour within a track — the timeline shows the song's structure at a
// glance. Purely display: free-text cues that never repeat simply each get
// their own tone.

/** Number of distinct section tones defined in CSS (`--section-0 … -5`). */
export const SECTION_PALETTE_SIZE = 6;

/**
 * Assign a palette index (0..SECTION_PALETTE_SIZE-1) per entry: equal cues
 * (case/whitespace-insensitive) share an index, distinct cues get the next one
 * in order of first appearance (wrapping). No cue → null (no section colour).
 */
export function assignSections(cues: (string | undefined)[]): (number | null)[] {
  const seen = new Map<string, number>();
  return cues.map((cue) => {
    const key = cue?.trim().toLowerCase();
    if (!key) return null;
    let idx = seen.get(key);
    if (idx === undefined) {
      idx = seen.size % SECTION_PALETTE_SIZE;
      seen.set(key, idx);
    }
    return idx;
  });
}
