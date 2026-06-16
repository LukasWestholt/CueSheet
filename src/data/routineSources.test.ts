import { describe, it, expect } from 'vitest';
import { mergeTracks, removeTracksByIds, newCustomId } from './routineSources';
import type { Track } from './tracks';

const t = (id: string): Track => ({
  id,
  spotifyUri: `spotify:track:${id}`,
  steps: [],
});

describe('mergeTracks', () => {
  it('appends tracks not already present', () => {
    const out = mergeTracks([t('a')], [t('b'), t('c')]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('skips ids already present (first wins, order preserved)', () => {
    const base = [t('a'), t('b')];
    const out = mergeTracks(base, [t('b'), t('c')]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    // The existing 'b' is kept, not replaced by the incoming one.
    expect(out[1]).toBe(base[1]);
  });

  it('does not mutate the base array', () => {
    const base = [t('a')];
    mergeTracks(base, [t('b')]);
    expect(base).toHaveLength(1);
  });
});

describe('removeTracksByIds', () => {
  it('removes ids in removeIds', () => {
    const out = removeTracksByIds([t('a'), t('b'), t('c')], new Set(['b']), new Set());
    expect(out.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('keeps ids that another enabled source still provides', () => {
    const out = removeTracksByIds(
      [t('a'), t('b')],
      new Set(['a', 'b']),
      new Set(['b']),
    );
    expect(out.map((x) => x.id)).toEqual(['b']);
  });

  it('never removes tracks owned by no source (not in removeIds)', () => {
    const out = removeTracksByIds([t('a'), t('authored')], new Set(['a']), new Set());
    expect(out.map((x) => x.id)).toEqual(['authored']);
  });
});

describe('newCustomId', () => {
  it('produces distinct ids', () => {
    expect(newCustomId()).not.toBe(newCustomId());
  });
});