// Track + step data model.
//
// Steps are authored MUSICALLY, not in seconds. Each step lasts a number of
// "Takte" (8-counts). The absolute time of each calling is derived from the
// track's first-beat timestamp + BPM (see src/data/beats.ts). Edit `steps`,
// `firstBeatSec`, and `bpm` below — never raw seconds.

export interface StepCalling {
  /** The move/step the coach calls out, e.g. "Jumping Jacks". */
  step: string;
  /** Optional detail, e.g. "8 counts", "double time", "arms up". */
  cue?: string;
  /**
   * Length of this step in "Takte" (8-counts). Half values (e.g. 2.5) allowed.
   * A step of x Takte = (x-1) bars of 8/8 + one closing 4/4; an extra .5 adds a 4/8.
   */
  takte: number;
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
// Tune firstBeatSec / bpm / takte to your track.
// ---------------------------------------------------------------------------
export const TRACKS: Track[] = [
  {
    id: 'warm-up-1',
    title: 'Low',
    artist: 'Flo Rida',
    spotifyUri: 'spotify:track:0t2w4jQazlBggyZS4axpnw',
    durationMs: 3 * 60_000 + 40_000,
    firstBeatSec: 0.45,
    bpm: 128,
    steps: [
      { step: 'Basic Bounce', cue: 'set the pace', takte: 4 },
      { step: 'Sprint', cue: 'fast feet', takte: 2 },
      { step: 'Tuck Jumps', cue: '4 counts', takte: 2.5 },
      { step: 'Sprint', cue: 'push!', takte: 4 },
      { step: 'Pike', cue: 'reach long', takte: 4 },
      { step: 'Tuck Jumps', cue: 'explosive', takte: 4 },
      { step: 'Sprint', cue: 'final push', takte: 2 },
      { step: 'Basic Bounce', cue: 'shake it out', takte: 4 },


      // 4	Jogging	intro
// 8	Basic + Low	chorus
// 8	Jogging + Kick	verse
// 8	Basic + Low	chorus
// 8	Jogging + Kick	verse
// 8	Basic + Low	chorus
// 8	Jogging + Kick	verse
// 8	Basic + Low	chorus
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
      { step: 'Seated Bounce', cue: 'engage core', takte: 4 },
      { step: 'Plank Hold', cue: 'on the mat', takte: 4 },
      { step: 'Single-Leg Bounce', cue: 'left', takte: 4 },
      { step: 'Single-Leg Bounce', cue: 'right', takte: 4 },
      { step: 'Balance Hold', cue: 'arms wide', takte: 4 },
      { step: 'Cool Down', cue: 'stretch tall', takte: 4 },
    ],
  },
];
