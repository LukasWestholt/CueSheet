import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Track } from './tracks';
import { loadStoredTracks, serializeTracks } from './tracksStore';

const track = (extra: Partial<Track>): Track => ({
  id: 't1',
  spotifyUri: 'spotify:track:x',
  steps: [{ step: 'Bounce', cue: '', measures: 4 }],
  ...extra,
});

// Map-backed localStorage stub (the test env has none).
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('serializeTracks', () => {
  it('exports faithfully — a deliberate firstBeatSec: 0 survives', () => {
    const out = JSON.parse(serializeTracks([track({ firstBeatSec: 0 })]));
    expect(out[0].firstBeatSec).toBe(0);
  });
});

describe('loadStoredTracks zero-firstBeat migration', () => {
  it('strips legacy firstBeatSec: 0 once and persists the cleaned list', () => {
    store.set(
      'tjf.tracks',
      JSON.stringify([track({ firstBeatSec: 0 }), track({ id: 't2', firstBeatSec: 1.3 })]),
    );

    const loaded = loadStoredTracks()!;
    expect('firstBeatSec' in loaded[0]).toBe(false);
    expect(loaded[1].firstBeatSec).toBe(1.3);
    // Written back, and marked done.
    expect(JSON.parse(store.get('tjf.tracks')!)[0].firstBeatSec).toBeUndefined();
    expect(store.get('tjf.zeroFirstBeatCleaned')).toBe('1');
  });

  it('after the migration, a 0 typed by the coach stays', () => {
    store.set('tjf.zeroFirstBeatCleaned', '1');
    store.set('tjf.tracks', JSON.stringify([track({ firstBeatSec: 0 })]));

    const loaded = loadStoredTracks()!;
    expect(loaded[0].firstBeatSec).toBe(0);
  });

  it('marks the migration done even when there was nothing to clean', () => {
    store.set('tjf.tracks', JSON.stringify([track({ firstBeatSec: 1 })]));
    loadStoredTracks();
    expect(store.get('tjf.zeroFirstBeatCleaned')).toBe('1');
  });
});
