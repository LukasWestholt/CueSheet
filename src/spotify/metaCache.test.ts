import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cached, clearCache, getCached, setCached } from './metaCache';

// Node 26 exposes an experimental global `localStorage` that is undefined and
// shadows jsdom's, so install a working in-memory one for these tests.
if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === null) {
  const store = new Map<string, string>();
  const mock = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => {
      store.delete(k);
    },
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
  } as Storage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  });
}

describe('metaCache', () => {
  beforeEach(() => {
    clearCache();
    localStorage.clear();
  });

  it('round-trips through memory and localStorage', () => {
    setCached('trackInfo', 'abc', { title: 'Hi' });
    expect(getCached('trackInfo', 'abc')).toEqual({ title: 'Hi' });
    // Persisted under the tjf.meta. prefix.
    expect(localStorage.getItem('tjf.meta.trackInfo.abc')).toBe(
      JSON.stringify({ title: 'Hi' }),
    );
  });

  it('returns undefined for a miss', () => {
    expect(getCached('trackInfo', 'nope')).toBeUndefined();
  });

  it('namespaces keys so different fields with the same id do not collide', () => {
    setCached('trackTempo', 'id1', 128);
    setCached('firstBeatSec', 'id1', 0.5);
    expect(getCached('trackTempo', 'id1')).toBe(128);
    expect(getCached('firstBeatSec', 'id1')).toBe(0.5);
  });

  it('reads a value persisted by a previous session (memory empty)', () => {
    localStorage.setItem('tjf.meta.trackInfo.persisted', JSON.stringify({ title: 'Old' }));
    clearMemoryOnly();
    expect(getCached('trackInfo', 'persisted')).toEqual({ title: 'Old' });
  });

  describe('cached()', () => {
    it('calls the fetcher only once on a cache hit', async () => {
      const fetcher = vi.fn().mockResolvedValue({ title: 'Song' });
      const a = await cached('trackInfo', 'x', fetcher);
      const b = await cached('trackInfo', 'x', fetcher);
      expect(a).toEqual({ title: 'Song' });
      expect(b).toEqual({ title: 'Song' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('does NOT cache null results, so failures stay retriable', async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(null) // transient 403
        .mockResolvedValueOnce(120); // later success
      const first = await cached('trackTempo', 'y', fetcher);
      const second = await cached('trackTempo', 'y', fetcher);
      const third = await cached('trackTempo', 'y', fetcher);
      expect(first).toBeNull();
      expect(second).toBe(120);
      expect(third).toBe(120); // now cached
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('caches falsy-but-non-null values like 0', async () => {
      const fetcher = vi.fn().mockResolvedValue(0);
      await cached('firstBeatSec', 'z', fetcher);
      const second = await cached('firstBeatSec', 'z', fetcher);
      expect(second).toBe(0);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  it('clearCache removes all tjf.meta. entries but leaves others', () => {
    setCached('trackInfo', 'a', 1);
    localStorage.setItem('other.key', 'keep');
    clearCache();
    expect(getCached('trackInfo', 'a')).toBeUndefined();
    expect(localStorage.getItem('tjf.meta.trackInfo.a')).toBeNull();
    expect(localStorage.getItem('other.key')).toBe('keep');
  });
});

/**
 * Drops only the in-memory layer (without touching localStorage) to simulate a
 * fresh page load reading persisted values. We clear and re-seed via the public
 * API by clearing the whole cache then restoring localStorage from a snapshot.
 */
function clearMemoryOnly(): void {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    snapshot[k] = localStorage.getItem(k)!;
  }
  clearCache();
  for (const [k, v] of Object.entries(snapshot)) localStorage.setItem(k, v);
}
