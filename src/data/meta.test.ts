import { describe, it, expect } from 'vitest';
import { resolveTrackMeta } from './meta';
import type { Track } from './tracks';

const base: Track = {
  id: 't',
  spotifyUri: 'spotify:track:t',
  steps: [{ step: 'A', measures: 4 }],
};

describe('resolveTrackMeta', () => {
  it('uses fetched values when the track authors none', () => {
    const r = resolveTrackMeta(base, {
      title: 'Low',
      artist: 'Flo Rida',
      durationMs: 220_000,
      bpm: 128,
      firstBeatSec: 1.2,
    });
    expect(r).toEqual({
      title: 'Low',
      artist: 'Flo Rida',
      durationMs: 220_000,
      bpm: 128,
      firstBeatSec: 1.2,
    });
  });

  it('authored values always override fetched ones', () => {
    const track: Track = { ...base, title: 'My Title', bpm: 130, firstBeatSec: 0.5 };
    const r = resolveTrackMeta(track, { title: 'Spotify Title', bpm: 128, firstBeatSec: 1.2 });
    expect(r.title).toBe('My Title');
    expect(r.bpm).toBe(130);
    expect(r.firstBeatSec).toBe(0.5);
  });

  it('falls back to safe defaults while nothing is known', () => {
    const r = resolveTrackMeta(base, {});
    expect(r.title).toBe('Loading…');
    expect(r.artist).toBe('');
    expect(r.durationMs).toBe(0);
    expect(r.bpm).toBeNull(); // keeps callings empty until a BPM exists
    expect(r.firstBeatSec).toBe(0);
  });

  it('treats null fetched values as unknown', () => {
    const r = resolveTrackMeta(base, { title: null, bpm: null });
    expect(r.title).toBe('Loading…');
    expect(r.bpm).toBeNull();
  });
});
