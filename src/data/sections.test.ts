import { describe, it, expect } from 'vitest';
import { assignSections, SECTION_PALETTE_SIZE } from './sections';

describe('assignSections', () => {
  it('gives equal cues the same index, in order of first appearance', () => {
    expect(assignSections(['intro', 'verse', 'chorus', 'verse', 'chorus'])).toEqual([
      0, 1, 2, 1, 2,
    ]);
  });

  it('normalises case and whitespace', () => {
    expect(assignSections(['Chorus', ' chorus ', 'CHORUS'])).toEqual([0, 0, 0]);
  });

  it('returns null for missing or blank cues', () => {
    expect(assignSections([undefined, '', '  ', 'drop'])).toEqual([null, null, null, 0]);
  });

  it('wraps around the palette', () => {
    const cues = Array.from({ length: SECTION_PALETTE_SIZE + 2 }, (_, i) => `s${i}`);
    const idx = assignSections(cues);
    expect(idx[SECTION_PALETTE_SIZE]).toBe(0);
    expect(idx[SECTION_PALETTE_SIZE + 1]).toBe(1);
  });
});
