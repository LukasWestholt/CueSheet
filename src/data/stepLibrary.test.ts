import { describe, it, expect } from 'vitest';
import { collectStepLibrary } from './stepLibrary';
import type { Track } from './tracks';

const tracks: Track[] = [
  {
    id: 'a',
    spotifyUri: 'spotify:track:a',
    steps: [
      { step: 'Jogging', cue: 'intro', measures: 4 },
      { step: 'Basic', cue: 'chorus', measures: 4 },
      { step: 'Jogging', cue: 'verse', measures: 4 },
    ],
  },
  {
    id: 'b',
    spotifyUri: 'spotify:track:b',
    steps: [
      { step: 'Jogging', cue: '', measures: 2 },
      { step: 'Tip Toe', cue: '', measures: 4 },
    ],
  },
];

describe('collectStepLibrary', () => {
  it('counts distinct moves across all routines, most used first', () => {
    const lib = collectStepLibrary(tracks);
    expect(lib.map((e) => e.step)).toEqual(['Jogging', 'Basic', 'Tip Toe']);
    expect(lib[0]).toMatchObject({ step: 'Jogging', count: 3 });
  });

  it('aggregates cues and measures by frequency', () => {
    const lib = collectStepLibrary(tracks);
    const jogging = lib.find((e) => e.step === 'Jogging')!;
    expect(jogging.measures[0]).toBe(4); // 4 appears twice, 2 once
    expect(jogging.cues).toContain('intro');
    expect(jogging.cues).toContain('verse');
    expect(jogging.cues).not.toContain(''); // blank cues excluded
  });

  it('ignores blank step names and returns [] for no tracks', () => {
    expect(collectStepLibrary([])).toEqual([]);
    const withBlank: Track[] = [
      { id: 'x', spotifyUri: 'spotify:track:x', steps: [{ step: '  ', measures: 4 }] },
    ];
    expect(collectStepLibrary(withBlank)).toEqual([]);
  });
});
