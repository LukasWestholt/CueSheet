import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimingPlayback } from './useTimingPlayback';
import * as api from '../spotify/api';
import type { PlaybackSnapshot } from '../spotify/api';

vi.mock('../spotify/api', () => ({
  playTrack: vi.fn(async () => {}),
  pause: vi.fn(async () => {}),
  getPlaybackState: vi.fn(async () => null),
}));

const URI = 'spotify:track:0t2w4jQazlBggyZS4axpnw';

// Map-backed localStorage stub (the test env has none) — the hook reads the
// persisted sync offset from it.
const store = new Map<string, string>();

const snap = (progressMs: number, over: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot => ({
  isPlaying: true,
  progressMs,
  durationMs: 200_000,
  trackUri: URI,
  deviceId: 'dev-1',
  deviceName: 'Tablet',
  deviceType: 'Tablet',
  volumePercent: null,
  fetchedAt: Date.now(),
  ...over,
});

describe('useTimingPlayback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('start() plays the track from 0 on the device and interpolates the position', async () => {
    const { result } = renderHook(() => useTimingPlayback(URI, 'dev-1'));
    await act(() => result.current.start());
    expect(api.playTrack).toHaveBeenCalledWith(URI, 'dev-1', 0);
    expect(result.current.playing).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(900));
    expect(result.current.positionSeconds).toBeGreaterThan(0.7);
    expect(result.current.positionSeconds).toBeLessThan(1.1);
  });

  it('adopts polled positions for the same track and ignores a foreign one', async () => {
    const { result } = renderHook(() => useTimingPlayback(URI, 'dev-1'));
    await act(() => result.current.start());

    vi.mocked(api.getPlaybackState).mockResolvedValue(snap(30_000));
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(result.current.positionSeconds).toBeGreaterThanOrEqual(30);

    vi.mocked(api.getPlaybackState).mockResolvedValue(
      snap(0, { trackUri: 'spotify:track:otherotherotherotherot' }),
    );
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(result.current.positionSeconds).toBeGreaterThanOrEqual(30); // not reset
  });

  it('applies the persisted sync offset to the tapped position', async () => {
    store.set('tjf.syncOffsetMs', '500');
    const { result } = renderHook(() => useTimingPlayback(URI, null));
    await act(() => result.current.start());
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(result.current.positionSeconds).toBeGreaterThanOrEqual(0.5);
  });

  it('stop() pauses only when we started playback, and unmount stops too', async () => {
    // RTL's auto-cleanup unmounts the previous test's hook after our
    // afterEach clears mocks — drop that legitimate pause call first.
    vi.mocked(api.pause).mockClear();
    const { result, unmount } = renderHook(() => useTimingPlayback(URI, 'dev-1'));
    act(() => result.current.stop());
    expect(api.pause).not.toHaveBeenCalled(); // never started → hands off

    await act(() => result.current.start());
    unmount();
    expect(api.pause).toHaveBeenCalledWith('dev-1');
  });

  it('surfaces a play failure as error instead of throwing', async () => {
    vi.mocked(api.playTrack).mockRejectedValueOnce(new Error('No active device'));
    const { result } = renderHook(() => useTimingPlayback(URI, null));
    await act(() => result.current.start());
    expect(result.current.playing).toBe(false);
    expect(result.current.error).toMatch(/No active device/);
  });
});
