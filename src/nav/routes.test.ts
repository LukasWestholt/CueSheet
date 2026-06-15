import { describe, it, expect } from 'vitest';
import { parsePath, trackPath, listPath } from './routes';

describe('parsePath', () => {
  it('maps / and unknown paths to the list', () => {
    expect(parsePath('/')).toEqual({ name: 'list' });
    expect(parsePath('/whatever')).toEqual({ name: 'list' });
  });

  it('recognizes the callback path', () => {
    expect(parsePath('/callback')).toEqual({ name: 'callback' });
  });

  it('parses a track id (with and without a trailing slash)', () => {
    expect(parsePath('/track/main-1-0')).toEqual({ name: 'track', id: 'main-1-0' });
    expect(parsePath('/track/main-1-0/')).toEqual({ name: 'track', id: 'main-1-0' });
  });

  it('decodes an encoded id', () => {
    expect(parsePath('/track/local%2Fabc')).toEqual({ name: 'track', id: 'local/abc' });
  });
});

describe('trackPath', () => {
  it('builds and round-trips through parsePath', () => {
    expect(trackPath('main-1-0')).toBe('/track/main-1-0');
    expect(parsePath(trackPath('local/abc'))).toEqual({ name: 'track', id: 'local/abc' });
  });
});

describe('base path (sub-path deploy, e.g. GitHub Pages)', () => {
  const base = '/CueSheet/';
  it('strips the base before matching', () => {
    expect(parsePath('/CueSheet/', base)).toEqual({ name: 'list' });
    expect(parsePath('/CueSheet/callback', base)).toEqual({ name: 'callback' });
    expect(parsePath('/CueSheet/track/main-1', base)).toEqual({ name: 'track', id: 'main-1' });
  });
  it('builds base-prefixed paths that round-trip', () => {
    expect(trackPath('main-1', base)).toBe('/CueSheet/track/main-1');
    expect(parsePath(trackPath('main-1', base), base)).toEqual({ name: 'track', id: 'main-1' });
    expect(listPath(base)).toBe('/CueSheet/');
  });
});
