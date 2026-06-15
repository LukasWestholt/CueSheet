import { describe, it, expect } from 'vitest';
import { POPULAR_TRACKS } from './popularTracks';

const URI_RE = /^spotify:track:[A-Za-z0-9]{22}$/;

describe('POPULAR_TRACKS', () => {
  it('has the full curated set of 20', () => {
    expect(POPULAR_TRACKS).toHaveLength(20);
  });

  it('every entry has a valid Spotify track URI', () => {
    for (const t of POPULAR_TRACKS) expect(t.uri).toMatch(URI_RE);
  });

  it('has no duplicate URIs', () => {
    const uris = POPULAR_TRACKS.map((t) => t.uri);
    expect(new Set(uris).size).toBe(uris.length);
  });

  it('has a title and artist for each entry', () => {
    for (const t of POPULAR_TRACKS) {
      expect(t.title.trim()).not.toBe('');
      expect(t.artist.trim()).not.toBe('');
    }
  });
});
