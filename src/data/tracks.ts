// Track + step data model.
//
// Steps are authored MUSICALLY, not in seconds. Each step lasts a number of
// measures (8-counts). The absolute time of each calling is derived from the
// track's first-beat timestamp + BPM (see src/data/beats.ts). Edit `steps`,
// `firstBeatSec`, and `bpm` below — never raw seconds.

export interface StepCalling {
  /** The move/step the coach calls out, e.g. "Jumping Jacks". */
  step: string;
  /** Optional detail, e.g. "8 counts", "double time", "arms up". */
  cue?: string;
  /**
   * Length of this step in measures ("Takte"), where one measure = a full
   * 8-count (8 beats). Half values (e.g. 2.5 = two 8/8 + one 4/8) allowed.
   */
  measures: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** Spotify track URI, e.g. "spotify:track:xxxxxxxxxxxxxxxxxxxxxx". */
  spotifyUri: string;
  /** Fallback duration (ms); the live value from Spotify overrides this. */
  durationMs: number;
  /** Seconds into the track where the first beat (count 1) lands. */
  firstBeatSec: number;
  /** Beats per minute. If omitted, the app tries to fetch it from Spotify. */
  bpm?: number;
  steps: StepCalling[];
}

/**
 * A step resolved to an absolute start time (seconds). Produced from a Track's
 * `steps` + `bpm` by buildCallings(); this is what the UI renders.
 */
export interface Calling {
  time: number;
  step: string;
  cue?: string;
}

// ---------------------------------------------------------------------------
// MOCK DATA — replace spotifyUri values with real tracks from your account.
// Find a URI in the Spotify app: Share → Copy Spotify URI.
// Tune firstBeatSec / bpm / measures to your track.
// ---------------------------------------------------------------------------
export const TRACKS: Track[] = [
  {
    id: 'warm-up-1',
    title: 'Low',
    artist: 'Flo Rida',
    spotifyUri: 'spotify:track:0t2w4jQazlBggyZS4axpnw',
    durationMs: 3 * 60_000 + 40_000,
    firstBeatSec: 1,
    bpm: 128,
    steps: [
      { step: 'Jogging', cue: 'intro', measures: 4 },
      { step: 'Basic + Low', cue: 'chorus', measures: 8 },
      { step: 'Jogging + Kick', cue: 'verse', measures: 8 },
      { step: 'Basic + Low', cue: 'chorus', measures: 8 },
      { step: 'Jogging + Kick', cue: 'verse', measures: 8 },
      { step: 'Basic + Low', cue: 'chorus', measures: 8 },
      { step: 'Jogging + Kick', cue: 'verse', measures: 8 },
      { step: 'Basic + Low', cue: 'chorus', measures: 8 },
    ],
  },
  {
    id: 'core-1',
    title: 'Core & Balance',
    artist: 'Demo Artist',
    spotifyUri: 'spotify:track:REPLACE_ME_0000000000003',
    durationMs: 3 * 60_000,
    firstBeatSec: 0.6,
    bpm: 120,
    steps: [
      { step: 'Seated Bounce', cue: 'engage core', measures: 4 },
      { step: 'Plank Hold', cue: 'on the mat', measures: 4 },
      { step: 'Single-Leg Bounce', cue: 'left', measures: 4 },
      { step: 'Single-Leg Bounce', cue: 'right', measures: 4 },
      { step: 'Balance Hold', cue: 'arms wide', measures: 4 },
      { step: 'Cool Down', cue: 'stretch tall', measures: 4 },
    ],
  },
];
