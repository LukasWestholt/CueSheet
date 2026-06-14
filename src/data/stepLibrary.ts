import type { Track } from './tracks';

export interface StepLibraryEntry {
  /** Distinct move name, e.g. "Bounce Balance". */
  step: string;
  /** How many times it appears across all routines. */
  count: number;
  /** Distinct non-empty cues seen for this move, most frequent first. */
  cues: string[];
  /** Distinct `measures` values seen for this move, most frequent first. */
  measures: number[];
}

function byFreqDesc(counts: Map<string | number, number>): (string | number)[] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
}

/**
 * Collects the distinct moves used across all routines into a reusable palette
 * for the step editor: each entry knows how often it's used and its most common
 * cues / measures (so inserting a move can prefill sensible defaults). Sorted by
 * usage, most-used first.
 */
export function collectStepLibrary(tracks: Track[]): StepLibraryEntry[] {
  const map = new Map<
    string,
    { count: number; cues: Map<string | number, number>; measures: Map<string | number, number> }
  >();

  for (const track of tracks) {
    for (const s of track.steps) {
      const name = s.step.trim();
      if (!name) continue;
      let entry = map.get(name);
      if (!entry) {
        entry = { count: 0, cues: new Map(), measures: new Map() };
        map.set(name, entry);
      }
      entry.count++;
      const cue = s.cue?.trim();
      if (cue) entry.cues.set(cue, (entry.cues.get(cue) ?? 0) + 1);
      entry.measures.set(s.measures, (entry.measures.get(s.measures) ?? 0) + 1);
    }
  }

  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([step, e]) => ({
      step,
      count: e.count,
      cues: byFreqDesc(e.cues) as string[],
      measures: byFreqDesc(e.measures) as number[],
    }));
}
