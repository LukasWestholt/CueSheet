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
  /** Spotify track URI, e.g. "spotify:track:xxxxxxxxxxxxxxxxxxxxxx". */
  spotifyUri: string;
  steps: StepCalling[];

  // Everything below is OPTIONAL — when omitted, it is read from Spotify.
  // An authored value always overrides the fetched one.

  /** Override the track title (else fetched from /tracks). */
  title?: string;
  /** Override the artist (else fetched from /tracks). */
  artist?: string;
  /** Override the duration in ms (else the live Spotify value is used). */
  durationMs?: number;
  /** Seconds into the track where count 1 lands (else from audio-analysis). */
  firstBeatSec?: number;
  /** Beats per minute (else from audio-features; both may be deprecated/403). */
  bpm?: number;
  /** Mark the routine as a work in progress (timings not finished/verified). */
  wip?: boolean;
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
// Built-in fallback tracks — a small sample used only as the offline / no-server
// safety net (see the export at the bottom). The real routine set ships as
// committed JSON in `public/playbook-2026.json` and is loaded on startup
// (src/data/recommendedImports.ts#loadDefaultRoutines); a localStorage override
// (imported/edited routines) wins over both.
// Find a URI in the Spotify app: Share → Copy Spotify URI.
// Tune firstBeatSec / bpm / measures to your track.
// ---------------------------------------------------------------------------
const DEFAULT_TRACKS: Track[] = [
  {
    id: 'main-1-0',
    title: 'Low',
    artist: 'Flo Rida',
    spotifyUri: 'spotify:track:0t2w4jQazlBggyZS4axpnw',
    durationMs: 3 * 60_000 + 40_000,
    firstBeatSec: 1,
    bpm: 128,
    steps: [
      { step: 'Jogging', cue: 'intro', measures: 4 },
      { step: 'Basic', cue: 'chorus', measures: 3 },
      { step: 'Low', cue: 'chorus', measures: 1 },
      { step: 'Basic', cue: 'chorus', measures: 3 },
      { step: 'Low', cue: 'chorus', measures: 1 },
      { step: 'Jogging', cue: 'verse', measures: 4 },
      { step: 'Kick', cue: 'verse', measures: 4 },
      { step: 'Basic', cue: 'chorus', measures: 3 },
      { step: 'Low', cue: 'chorus', measures: 1 },
      { step: 'Basic', cue: 'chorus', measures: 3 },
      { step: 'Low', cue: 'chorus', measures: 1 },
      { step: 'Jogging', cue: 'verse', measures: 4 },
      { step: 'Kick', cue: 'verse', measures: 4 },
      { step: 'Basic', cue: 'chorus', measures: 3 },
      { step: 'Low', cue: 'chorus', measures: 1 },
      { step: 'Basic', cue: 'chorus', measures: 3 },
      { step: 'Low', cue: 'chorus', measures: 1 },
      { step: 'Jogging', cue: 'verse', measures: 4 },
      { step: 'Kick', cue: 'verse', measures: 4 },
      { step: 'Basic', cue: 'chorus', measures: 3 },
      { step: 'Low', cue: 'chorus', measures: 1 },
      { step: 'Basic', cue: 'chorus', measures: 3 },
      { step: 'Low', cue: 'chorus', measures: 1 },
    ],
  },
  {
    id: 'main-1-1',
    spotifyUri: 'spotify:track:3CeCwYWvdfXbZLXFhBrbnf',
    firstBeatSec: 1,
    // 119 beats Love Story
    steps: [
      { step: 'Tip Toe', cue: '', measures: 4 },
      { step: 'Bounce Balance', cue: '', measures: 8 },
      { step: 'Jogging', cue: '', measures: 4 },
      { step: 'Pony', cue: '', measures: 4 },
      { step: 'Bounce Balance', cue: '', measures: 4 },
      { step: 'Jogging', cue: '', measures: 4 },
      { step: 'Pony', cue: '', measures: 8 },
      { step: 'Jogging', cue: '', measures: 4 },
      { step: 'Tip Toe', cue: '', measures: 4 },
      { step: 'Jogging', cue: '', measures: 4 },
      { step: 'Pony', cue: '', measures: 4 },
      { step: 'Tip Toe', cue: '', measures: 4 },
    ],
  },
  {
    id: 'main-1-2',
    spotifyUri: 'spotify:track:4zPVMv84MMHehLNZYIS1Zv',
    firstBeatSec: 1,
    // 130 beats Barbie Girl Tiesto
    steps: [
      { step: 'Jogging', cue: '', measures: 4 },
      { step: 'Tip Toe', cue: '', measures: 4.5 },
      { step: 'Jogging', cue: '', measures: 4 },
      { step: 'Kick', cue: '', measures: 4 },
      { step: 'Kick Double', cue: '', measures: 4 },
      { step: 'Tip Toe', cue: '', measures: 4 },
      { step: 'Bounce Balance', cue: '', measures: 4 },
      { step: 'Jogging', cue: '', measures: 4 },
      { step: 'Kick', cue: '', measures: 4 },
      { step: 'Kick im V', cue: '', measures: 4 },
    ],
  },
];

// The built-in fallback list. At runtime the app prefers a localStorage override,
// then the public-folder default set (`playbook-2026.json`); these tracks are
// only used when neither is available (offline before the SW has precached).
export const TRACKS: Track[] = DEFAULT_TRACKS;
