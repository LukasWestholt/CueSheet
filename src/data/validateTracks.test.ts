import { describe, it, expect } from 'vitest';
import { validateTracks } from './validateTracks';
import type { Track } from './tracks';

const good: Track[] = [
  {
    id: 'a',
    spotifyUri: 'spotify:track:0t2w4jQazlBggyZS4axpnw',
    bpm: 128,
    firstBeatSec: 1,
    steps: [
      { step: 'Jogging', cue: 'intro', measures: 4 },
      { step: 'Basic', cue: '', measures: 2.5 },
    ],
  },
];

describe('validateTracks', () => {
  it('accepts a well-formed track list', () => {
    const r = validateTracks(good);
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
    expect(r.trackCount).toBe(1);
  });

  it('errors when not an array', () => {
    const r = validateTracks({ not: 'an array' });
    expect(r.ok).toBe(false);
    expect(r.issues[0].message).toMatch(/array/i);
  });

  it('errors on missing id, uri, and empty steps', () => {
    const r = validateTracks([{ steps: [] }]);
    expect(r.ok).toBe(false);
    const msgs = r.issues.map((i) => i.message).join(' | ');
    expect(msgs).toMatch(/id/);
    expect(msgs).toMatch(/spotifyUri/);
    expect(msgs).toMatch(/steps/);
  });

  it('errors on non-positive or non-number measures', () => {
    const bad = [{ id: 'x', spotifyUri: 'spotify:track:0t2w4jQazlBggyZS4axpnw', steps: [{ step: 'A', measures: 0 }] }];
    expect(validateTracks(bad).ok).toBe(false);
    const bad2 = [{ id: 'x', spotifyUri: 'spotify:track:0t2w4jQazlBggyZS4axpnw', steps: [{ step: 'A', measures: 'four' }] }];
    expect(validateTracks(bad2).ok).toBe(false);
  });

  it('errors on a blank step name', () => {
    const bad = [{ id: 'x', spotifyUri: 'spotify:track:0t2w4jQazlBggyZS4axpnw', steps: [{ step: '  ', measures: 4 }] }];
    expect(validateTracks(bad).ok).toBe(false);
  });

  it('errors on duplicate ids but only warns on duplicate URIs', () => {
    const uri = 'spotify:track:0t2w4jQazlBggyZS4axpnw';
    const dupId = validateTracks([
      { id: 'same', spotifyUri: uri, steps: [{ step: 'A', measures: 4 }] },
      { id: 'same', spotifyUri: 'spotify:track:3CeCwYWvdfXbZLXFhBrbnf', steps: [{ step: 'B', measures: 4 }] },
    ]);
    expect(dupId.ok).toBe(false);
    expect(dupId.issues.some((i) => i.level === 'error' && /Duplicate id/.test(i.message))).toBe(true);

    const dupUri = validateTracks([
      { id: 'a', spotifyUri: uri, steps: [{ step: 'A', measures: 4 }] },
      { id: 'b', spotifyUri: uri, steps: [{ step: 'B', measures: 4 }] },
    ]);
    expect(dupUri.ok).toBe(true); // warning only
    expect(dupUri.issues.some((i) => i.level === 'warning' && /share this Spotify URI/.test(i.message))).toBe(true);
  });

  it('warns (not errors) on odd measures, out-of-range bpm, and non-standard URI', () => {
    const r = validateTracks([
      { id: 'a', spotifyUri: 'low', bpm: 300, steps: [{ step: 'A', measures: 1.3 }] },
    ]);
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.level === 'warning').length).toBeGreaterThanOrEqual(3);
  });

  it('errors on a negative firstBeatSec', () => {
    const r = validateTracks([
      { id: 'a', spotifyUri: 'spotify:track:0t2w4jQazlBggyZS4axpnw', firstBeatSec: -1, steps: [{ step: 'A', measures: 4 }] },
    ]);
    expect(r.ok).toBe(false);
  });
});
