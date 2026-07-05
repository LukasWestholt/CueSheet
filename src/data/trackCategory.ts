import type { StepCalling, Track } from './tracks';
import { signaturesOf } from './signatureMoves';

export type TrackCategory = NonNullable<Track['category']>;

export const TRACK_CATEGORIES: TrackCategory[] = ['warmup', 'main', 'main2'];

/** Everything at main-part tempo or above is a main-part track. */
export const MAIN_PART_MIN_BPM = 112;

/** Short badge labels. */
export const CATEGORY_LABELS: Record<TrackCategory, string> = {
  warmup: 'Warm-up',
  main: 'Main',
  main2: 'Main 2',
};

/** Full names for tooltips and the editor. */
export const CATEGORY_TITLES: Record<TrackCategory, string> = {
  warmup: 'Warm-up / cool-down (below 112 BPM)',
  main: 'Main part (112+ BPM)',
  main2: 'Main part 2 (112+ BPM with stomps)',
};

/**
 * Derives the session category from tempo + moves: below 112 BPM is a
 * warm-up / cool-down track; at main-part tempo, a routine containing any
 * stomp move ("Stomp", "Stomping …") is main part 2, the rest main part.
 * Unknown BPM → null (no category shown).
 */
export function deriveCategory(
  bpm: number | null | undefined,
  steps: StepCalling[],
): TrackCategory | null {
  if (bpm == null || bpm <= 0) return null;
  if (bpm < MAIN_PART_MIN_BPM) return 'warmup';
  return steps.some((s) => signaturesOf(s.step).includes('Stomp')) ? 'main2' : 'main';
}

/**
 * A track's effective category: the authored override wins; otherwise derived
 * from the given resolved BPM (pass the calibration/fetched value when the
 * track doesn't author one — defaults to `track.bpm`).
 */
export function categoryOf(track: Track, bpm?: number | null): TrackCategory | null {
  if (track.category) return track.category;
  return deriveCategory(bpm ?? track.bpm, track.steps);
}
