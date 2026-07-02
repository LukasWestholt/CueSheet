import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getBpmByIsrc, getBpmByTitleArtist } = vi.hoisted(() => ({
  getBpmByIsrc: vi.fn<() => Promise<number | null>>(),
  getBpmByTitleArtist: vi.fn<() => Promise<number | null>>(),
}));
vi.mock('./deezer', () => ({ getBpmByIsrc }));
vi.mock('./getsongbpm', () => ({ getBpmByTitleArtist }));

import { lookupBpm } from './bpmLookup';

beforeEach(() => {
  getBpmByIsrc.mockReset();
  getBpmByTitleArtist.mockReset();
});

describe('lookupBpm', () => {
  it('prefers Deezer by ISRC and skips the fallback', async () => {
    getBpmByIsrc.mockResolvedValue(128);
    expect(await lookupBpm({ isrc: 'X', title: 'T', artist: 'A' })).toBe(128);
    expect(getBpmByTitleArtist).not.toHaveBeenCalled();
  });

  it('falls back to GetSongBPM when Deezer has no data', async () => {
    getBpmByIsrc.mockResolvedValue(null);
    getBpmByTitleArtist.mockResolvedValue(140);
    expect(await lookupBpm({ isrc: 'X', title: 'T', artist: 'A' })).toBe(140);
    expect(getBpmByTitleArtist).toHaveBeenCalledWith('T', 'A');
  });

  it('goes straight to GetSongBPM without an ISRC', async () => {
    getBpmByTitleArtist.mockResolvedValue(132);
    expect(await lookupBpm({ title: 'T', artist: 'A' })).toBe(132);
    expect(getBpmByIsrc).not.toHaveBeenCalled();
  });

  it('returns null (never throws) when both sources fail', async () => {
    getBpmByIsrc.mockRejectedValue(new Error('down'));
    getBpmByTitleArtist.mockRejectedValue(new Error('down'));
    expect(await lookupBpm({ isrc: 'X', title: 'T', artist: 'A' })).toBeNull();
  });
});
