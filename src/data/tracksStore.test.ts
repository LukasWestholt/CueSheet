import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Track } from './tracks';
import { loadStoredTracks, serializeTracks } from './tracksStore';

const track = (extra: Partial<Track>): Track => ({
  id: 't1',
  spotifyUri: 'spotify:track:x',
  steps: [{ step: 'Bounce', cue: '', measures: 4 }],
  ...extra,
});

// Map-backed localStorage stub (the test env has none). length/key back the
// calibration-migration prefix scan (keysWithPrefix).
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
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

describe('loadStoredTracks legacy-calibration migration', () => {
  it('folds tapped bpm/firstBeat into tracks missing them and deletes the store', () => {
    store.set('tjf.zeroFirstBeatCleaned', '1');
    store.set(
      'tjf.tracks',
      JSON.stringify([
        track({ spotifyUri: 'spotify:track:a' }),
        track({ id: 't2', spotifyUri: 'spotify:track:b', bpm: 130 }),
      ]),
    );
    store.set('tjf.cal.spotify:track:a', JSON.stringify({ bpm: 124, firstBeatSec: 1.3 }));
    store.set('tjf.cal.spotify:track:b', JSON.stringify({ bpm: 999, firstBeatSec: 0.5 }));

    const loaded = loadStoredTracks()!;
    // Missing values are filled…
    expect(loaded[0].bpm).toBe(124);
    expect(loaded[0].firstBeatSec).toBe(1.3);
    // …but authored values win; only the gap is filled.
    expect(loaded[1].bpm).toBe(130);
    expect(loaded[1].firstBeatSec).toBe(0.5);
    // Persisted, and the legacy keys are gone.
    expect(JSON.parse(store.get('tjf.tracks')!)[0].bpm).toBe(124);
    expect(store.has('tjf.cal.spotify:track:a')).toBe(false);
    expect(store.has('tjf.cal.spotify:track:b')).toBe(false);
  });

  it('leaves the list untouched when no legacy calibration exists', () => {
    store.set('tjf.zeroFirstBeatCleaned', '1');
    store.set('tjf.tracks', JSON.stringify([track({})]));
    const loaded = loadStoredTracks()!;
    expect(loaded[0].bpm).toBeUndefined();
  });

  it('deletes an orphaned calibration (no matching track) without changing tracks', () => {
    store.set('tjf.zeroFirstBeatCleaned', '1');
    store.set('tjf.tracks', JSON.stringify([track({ spotifyUri: 'spotify:track:a' })]));
    store.set('tjf.cal.spotify:track:zzz', JSON.stringify({ bpm: 100 }));
    const loaded = loadStoredTracks()!;
    expect(loaded[0].bpm).toBeUndefined();
    expect(store.has('tjf.cal.spotify:track:zzz')).toBe(false);
  });
});
