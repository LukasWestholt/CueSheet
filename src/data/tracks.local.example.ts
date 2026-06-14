// Template for your PRIVATE track list.
//
// Copy this file to `src/data/tracks.local.ts` (which is gitignored, so it is
// never committed/pushed) and put your real routines in it. When that file
// exists, `tracks.ts` loads its `TRACKS` instead of the committed defaults.
//
// Same shape as DEFAULT_TRACKS in tracks.ts: only `id`, `spotifyUri` and
// `steps` are required; title/artist/durationMs/firstBeatSec/bpm are optional
// (fetched from Spotify when omitted). `measures` are 8-counts (halves allowed),
// and the section label goes in `cue`.

import type { Track } from './tracks';

export const TRACKS: Track[] = [
  {
    id: 'local-1',
    spotifyUri: 'spotify:track:0t2w4jQazlBggyZS4axpnw',
    firstBeatSec: 0,
    bpm: 128,
    // Low — Flo Rida
    steps: [
      { step: 'Jogging', cue: 'intro', measures: 4 },
      { step: 'Basic', cue: 'chorus', measures: 3 },
      { step: 'Low', cue: 'chorus', measures: 1 },
      { step: 'Jogging', cue: 'verse', measures: 4 },
      { step: 'Kick', cue: 'verse', measures: 4 },
    ],
  },
];
