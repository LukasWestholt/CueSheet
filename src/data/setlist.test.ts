import { describe, it, expect } from 'vitest';
import { resolveSetlist, sessionEstimate } from './setlist';
import type { Track } from './tracks';

const t = (id: string): Track => ({ id, spotifyUri: `spotify:track:${id}`, steps: [{ step: 'A', measures: 4 }] });

describe('resolveSetlist', () => {
  it('maps ids to tracks in order, dropping unknown ids', () => {
    const tracks = [t('a'), t('b'), t('c')];
    expect(resolveSetlist(['c', 'a', 'x'], tracks).map((x) => x.id)).toEqual(['c', 'a']);
  });
});

describe('sessionEstimate', () => {
  const durs = [200_000, 180_000, 220_000]; // 3 tracks
  const gap = 10;

  it('is zero for an empty setlist', () => {
    expect(sessionEstimate([], 0, 0, gap)).toEqual({ totalMs: 0, remainingMs: 0 });
  });

  it('total = sum of durations + a gap between each pair', () => {
    const { totalMs } = sessionEstimate(durs, 0, 0, gap);
    expect(totalMs).toBe(600_000 + 2 * 10_000);
  });

  it('at the very start, remaining equals total', () => {
    const { totalMs, remainingMs } = sessionEstimate(durs, 0, 0, gap);
    expect(remainingMs).toBe(totalMs);
  });

  it('shrinks as the current track plays and tracks complete', () => {
    // Halfway through track 2 (index 1, 90s in): rest of track2 + gap + track3.
    const { remainingMs } = sessionEstimate(durs, 1, 90_000, gap);
    expect(remainingMs).toBe(90_000 + 220_000 + 10_000);
  });

  it('on the last track, no gaps remain', () => {
    const { remainingMs } = sessionEstimate(durs, 2, 20_000, gap);
    expect(remainingMs).toBe(200_000); // 220000 - 20000, no trailing gap
  });

  it('treats unknown (0) durations and clamps out-of-range index/pos', () => {
    expect(sessionEstimate([0, 0], 5, -100, gap)).toEqual({
      totalMs: 10_000, // just the single gap
      remainingMs: 0, // clamped to last track, 0 duration, no gaps ahead
    });
  });
});
