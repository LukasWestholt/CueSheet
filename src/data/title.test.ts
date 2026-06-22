import { describe, it, expect } from 'vitest';
import { cleanTitle } from './title';

describe('cleanTitle', () => {
  it('strips a dash-separated qualifier and marks it with an ellipsis', () => {
    expect(cleanTitle('Titanium - Radio Edit')).toBe('Titanium…');
    expect(cleanTitle('Sweet Dreams - 2018 Remaster')).toBe('Sweet Dreams…');
    expect(cleanTitle('Wake Me Up - Single Version')).toBe('Wake Me Up…');
  });

  it('strips a bracketed qualifier', () => {
    expect(cleanTitle('Levels (Original Mix)')).toBe('Levels…');
    expect(cleanTitle('Animals [Extended Mix]')).toBe('Animals…');
    expect(cleanTitle('Song (Remastered)')).toBe('Song…');
  });

  it('peels multiple trailing qualifiers', () => {
    expect(cleanTitle('Song (Remastered) - Radio Edit')).toBe('Song…');
  });

  it('keeps genuinely meaningful suffixes', () => {
    expect(cleanTitle('Levels (David Guetta Remix)')).toBe('Levels (David Guetta Remix)');
    expect(cleanTitle('Sugar (feat. Francesco Yates)')).toBe('Sugar (feat. Francesco Yates)');
    expect(cleanTitle('Hello - Live at Wembley')).toBe('Hello - Live at Wembley');
  });

  it('leaves a clean title untouched', () => {
    expect(cleanTitle('Born Slippy')).toBe('Born Slippy');
    expect(cleanTitle('  Padded Title  ')).toBe('Padded Title');
  });

  it('does not strip a qualifier word that is mid-title', () => {
    expect(cleanTitle('Edit of My Life')).toBe('Edit of My Life');
  });

  it('does not match "mix" inside "remix"', () => {
    expect(cleanTitle('Strobe - Deadmau5 Remix')).toBe('Strobe - Deadmau5 Remix');
  });
});