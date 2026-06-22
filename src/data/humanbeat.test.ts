import { describe, it, expect } from 'vitest';
import { humanBeat, preCloseGroups } from './callings';

describe('humanBeat', () => {
  it('reports end of track when there is no next step', () => {
    expect(humanBeat(3, null)).toEqual({ count: null, mode: 'end', announcing: false });
  });

  it('counts the running 8-count with the measure number on each downbeat', () => {
    // beatsToNext large (>8) so we are in the running count, not the close.
    const far = 100;
    // Measure 1: "1 2 3 4 5 6 7 8"
    expect(humanBeat(0, far)).toMatchObject({ count: 1, mode: 'count' });
    expect(humanBeat(1, far)).toMatchObject({ count: 2, mode: 'count' });
    expect(humanBeat(7, far)).toMatchObject({ count: 8, mode: 'count' });
    // Measure 2: first beat shows the measure number "2", then 2 3 4 …
    expect(humanBeat(8, far)).toMatchObject({ count: 2, mode: 'count' });
    expect(humanBeat(9, far)).toMatchObject({ count: 2, mode: 'count' });
    // Measure 3 downbeat
    expect(humanBeat(16, far)).toMatchObject({ count: 3, mode: 'count' });
    expect(humanBeat(17, far)).toMatchObject({ count: 2, mode: 'count' });
  });

  it('a half measure falls out as a short "N 2 3 4" group', () => {
    // 4.5-measure step = 36 beats; the orphan 4-count is beats 24..27 (measure 4),
    // sitting right before the 8-beat close (beats 28..35).
    expect(humanBeat(24, 12)).toMatchObject({ count: 4, mode: 'count' }); // "4"
    expect(humanBeat(25, 11)).toMatchObject({ count: 2, mode: 'count' }); // "2"
    expect(humanBeat(26, 10)).toMatchObject({ count: 3, mode: 'count' }); // "3"
    expect(humanBeat(27, 9)).toMatchObject({ count: 4, mode: 'count' }); // "4"
  });

  it('closes with "4 3 2" over the last 8 beats, announcing the move', () => {
    expect(humanBeat(28, 8)).toMatchObject({ count: 4, mode: 'countdown', announcing: true });
    expect(humanBeat(29, 7)).toMatchObject({ count: 4, mode: 'countdown' });
    expect(humanBeat(30, 6)).toMatchObject({ count: 3, mode: 'countdown' });
    expect(humanBeat(31, 5)).toMatchObject({ count: 3, mode: 'countdown' });
    expect(humanBeat(32, 4)).toMatchObject({ count: 2, mode: 'countdown' });
    expect(humanBeat(33, 3)).toMatchObject({ count: 2, mode: 'countdown' });
  });

  it('never shows "1" — the final 2 beats announce the move instead', () => {
    expect(humanBeat(34, 2)).toEqual({ count: null, mode: 'announce', announcing: true });
    expect(humanBeat(35.5, 0.5)).toEqual({ count: null, mode: 'announce', announcing: true });
    expect(humanBeat(36, 0)).toEqual({ count: null, mode: 'announce', announcing: true });
  });

  it('is not announcing while still in the running count', () => {
    expect(humanBeat(4, 40).announcing).toBe(false);
  });

  describe('half-count placement', () => {
    const step = (measures: number, halfPosition?: number) => ({ measures, halfPosition });

    it('front-places the half (halfPosition 0): "1 2 3 4, 1 2 3 4 5 6 7 8, …"', () => {
      const s = step(4.5, 0);
      // orphan first (beats 0..3), labelled 1
      expect(humanBeat(0, 36, s).count).toBe(1);
      expect(humanBeat(1, 35, s).count).toBe(2);
      expect(humanBeat(3, 33, s).count).toBe(4);
      // then the full measures, labelled 1, 2, 3 (downbeats at 4, 12, 20)
      expect(humanBeat(4, 32, s).count).toBe(1);
      expect(humanBeat(12, 24, s).count).toBe(2);
      expect(humanBeat(20, 16, s).count).toBe(3);
    });

    it('default places the half just before the close: "… 4 2 3 4, 4 3 2 →"', () => {
      const s = step(4.5); // no halfPosition → natural
      expect(humanBeat(0, 36, s).count).toBe(1);
      expect(humanBeat(8, 28, s).count).toBe(2);
      expect(humanBeat(16, 20, s).count).toBe(3);
      expect(humanBeat(24, 12, s).count).toBe(4); // orphan downbeat "4"
      expect(humanBeat(25, 11, s).count).toBe(2);
    });

    it('preCloseGroups lays out the pre-close measures + orphan', () => {
      // 4.5 front: [½:1][1:1][1:2][1:3]
      expect(preCloseGroups(4.5, 0)).toEqual([
        { len: 4, label: 1 },
        { len: 8, label: 1 },
        { len: 8, label: 2 },
        { len: 8, label: 3 },
      ]);
      // 4.5 natural: [1:1][1:2][1:3][½:4]
      expect(preCloseGroups(4.5)).toEqual([
        { len: 8, label: 1 },
        { len: 8, label: 2 },
        { len: 8, label: 3 },
        { len: 4, label: 4 },
      ]);
      // whole measures: just the full measures before the close
      expect(preCloseGroups(4)).toEqual([
        { len: 8, label: 1 },
        { len: 8, label: 2 },
        { len: 8, label: 3 },
      ]);
    });
  });
});