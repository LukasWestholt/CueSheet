import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadRecommendedRoutines,
  loadDefaultRoutines,
  isDefaultRoutineFile,
  isDefaultRoutine,
} from './recommendedImports';
import type { Track } from './tracks';

const sampleTrack = (id: string): Track => ({
  id,
  spotifyUri: 'spotify:track:0t2w4jQazlBggyZS4axpnw',
  steps: [{ step: 'Jogging', measures: 4 }],
});

function mockFetch(impl: (url: string) => Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => impl(url) as Response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadRecommendedRoutines', () => {
  it('parses a { routines: [...] } manifest', async () => {
    mockFetch(() => ({
      ok: true,
      json: async () => ({
        routines: [{ file: 'default.json', label: 'Default', description: 'd' }],
      }),
    }));
    const list = await loadRecommendedRoutines();
    expect(list).toEqual([{ file: 'default.json', label: 'Default', description: 'd' }]);
  });

  it('carries an explicit default flag through', async () => {
    mockFetch(() => ({
      ok: true,
      json: async () => ({ routines: [{ file: 'playbook-2026.json', default: true }] }),
    }));
    const [entry] = await loadRecommendedRoutines();
    expect(entry.default).toBe(true);
  });

  it('accepts a bare array and defaults the label to the file name', async () => {
    mockFetch(() => ({ ok: true, json: async () => [{ file: 'a.json' }] }));
    const list = await loadRecommendedRoutines();
    expect(list).toEqual([{ file: 'a.json', label: 'a.json', description: undefined }]);
  });

  it('drops malformed entries and ones without a file', async () => {
    mockFetch(() => ({
      ok: true,
      json: async () => [{ label: 'no file' }, 'nope', { file: 'ok.json' }],
    }));
    const list = await loadRecommendedRoutines();
    expect(list.map((e) => e.file)).toEqual(['ok.json']);
  });

  it('returns [] on a non-ok response', async () => {
    mockFetch(() => ({ ok: false, json: async () => ({}) }));
    expect(await loadRecommendedRoutines()).toEqual([]);
  });

  it('returns [] when fetch throws (offline / missing)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await loadRecommendedRoutines()).toEqual([]);
  });
});

describe('isDefaultRoutineFile', () => {
  it('matches default.json and default.<x>.json (with or without a path)', () => {
    expect(isDefaultRoutineFile('default.json')).toBe(true);
    expect(isDefaultRoutineFile('/default.json')).toBe(true);
    expect(isDefaultRoutineFile('/routines/default.advanced.json')).toBe(true);
  });
  it('does not match other files', () => {
    expect(isDefaultRoutineFile('extra.json')).toBe(false);
    expect(isDefaultRoutineFile('mydefault.json')).toBe(false);
    expect(isDefaultRoutineFile('default.txt')).toBe(false);
  });
});

describe('isDefaultRoutine', () => {
  it('is true for a flagged entry or a default*.json name', () => {
    expect(isDefaultRoutine({ file: 'playbook-2026.json', label: '', default: true })).toBe(true);
    expect(isDefaultRoutine({ file: '/default.json', label: '' })).toBe(true);
  });
  it('is false for an unflagged, non-default-named entry', () => {
    expect(isDefaultRoutine({ file: 'example.json', label: '' })).toBe(false);
  });
});

describe('loadDefaultRoutines', () => {
  it('loads + concatenates only the default*.json files, deduping ids', async () => {
    mockFetch((url) => {
      if (url.includes('routines.json')) {
        return {
          ok: true,
          json: async () => ({
            routines: [
              { file: '/default.json' },
              { file: '/default.extra.json' },
              { file: '/other.json' }, // not a default — must be ignored here
            ],
          }),
        };
      }
      if (url.includes('default.json')) {
        return { ok: true, json: async () => [sampleTrack('a'), sampleTrack('b')] };
      }
      if (url.includes('default.extra.json')) {
        // 'a' is a duplicate id and should be dropped; 'c' is kept.
        return { ok: true, json: async () => [sampleTrack('a'), sampleTrack('c')] };
      }
      return { ok: false, json: async () => ({}) };
    });
    const tracks = await loadDefaultRoutines();
    expect(tracks.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('loads a file flagged default even when not named default*.json', async () => {
    mockFetch((url) => {
      if (url.includes('routines.json')) {
        return {
          ok: true,
          json: async () => ({
            routines: [
              { file: '/playbook-2026.json', default: true },
              { file: '/example.json' }, // not a default — ignored here
            ],
          }),
        };
      }
      if (url.includes('playbook-2026.json')) {
        return { ok: true, json: async () => [sampleTrack('a'), sampleTrack('b')] };
      }
      return { ok: true, json: async () => [sampleTrack('z')] };
    });
    const tracks = await loadDefaultRoutines();
    expect(tracks.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('returns [] when there is no manifest', async () => {
    mockFetch(() => ({ ok: false, json: async () => ({}) }));
    expect(await loadDefaultRoutines()).toEqual([]);
  });

  it('skips a default file that fails validation', async () => {
    mockFetch((url) => {
      if (url.includes('routines.json')) {
        return { ok: true, json: async () => ({ routines: [{ file: '/default.json' }] }) };
      }
      return { ok: true, json: async () => [{ id: 'bad' }] }; // no steps/uri -> invalid
    });
    expect(await loadDefaultRoutines()).toEqual([]);
  });
});
