import { describe, it, expect } from 'vitest';
import { mirrorCue } from './mirror';

describe('mirrorCue', () => {
  it('swaps English left/right words', () => {
    expect(mirrorCue('left kick')).toBe('right kick');
    expect(mirrorCue('step right, then left')).toBe('step left, then right');
  });

  it('swaps German links/rechts', () => {
    expect(mirrorCue('links antippen')).toBe('rechts antippen');
    expect(mirrorCue('Rechts beginnen')).toBe('Links beginnen');
  });

  it('swaps bare L/R markers, preserving case', () => {
    expect(mirrorCue('Kick L')).toBe('Kick R');
    expect(mirrorCue('r arm up')).toBe('l arm up');
    expect(mirrorCue('LEFT')).toBe('RIGHT');
    expect(mirrorCue('Left')).toBe('Right');
  });

  it('swaps both sides of a pair without double-swapping', () => {
    expect(mirrorCue('left-right-left')).toBe('right-left-right');
  });

  it('leaves unrelated words (and substrings) alone', () => {
    expect(mirrorCue('Jumping Jacks')).toBe('Jumping Jacks');
    // 'leftover' contains 'left' but is not the word 'left'.
    expect(mirrorCue('leftover energy')).toBe('leftover energy');
  });
});
