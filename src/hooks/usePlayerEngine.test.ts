import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Track } from '../data/tracks';
import type { PlaybackSnapshot } from '../spotify/api';

// Mocked Spotify API (hoisted so the vi.mock factory can reference it).
const { playTrack, pause, resume, getPlaybackState } = vi.hoisted(() => ({
  playTrack: vi.fn(async () => {}),
  pause: vi.fn(async () => {}),
  resume: vi.fn(async () => {}),
  getPlaybackState: vi.fn<() => Promise<PlaybackSnapshot | null>>(),
}));
vi.mock('../spotify/api', () => ({ playTrack, pause, resume, getPlaybackState }));

import { usePlayerEngine } from './usePlayerEngine';

const tracks: Track[] = [
  { id: 'a', title: 'A', artist: 'x', spotifyUri: 'spotify:track:a', durationMs: 10_000, callings: [{ time: 0, step: 'S1' }] },
  { id: 'b', title: 'B', artist: 'x', spotifyUri: 'spotify:track:b', durationMs: 10_000, callings: [{ time: 0, step: 'S2' }] },
];

/** getPlaybackState mock that reports a track effectively at its end. */
function reportNearEnd(uri: string) {
  getPlaybackState.mockImplementation(async () => ({
    isPlaying: true,
    progressMs: 9_900,
    durationMs: 10_000,
    trackUri: uri,
    deviceId: 'd',
    deviceName: 'Tablet',
    fetchedAt: Date.now(),
  }));
}

async function startAt(result: { current: ReturnType<typeof usePlayerEngine> }, i: number) {
  await act(async () => {
    result.current.start(i);
    await vi.advanceTimersByTimeAsync(5); // flush the playTrack() microtask
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  playTrack.mockClear();
  pause.mockClear();
  resume.mockClear();
  getPlaybackState.mockReset();
  getPlaybackState.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePlayerEngine', () => {
  it('start() plays the track on the selected device and enters "playing"', async () => {
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    expect(playTrack).toHaveBeenCalledWith('spotify:track:a', 'dev', 0);
    expect(result.current.phase).toBe('playing');
    expect(result.current.index).toBe(0);
  });

  it('auto-continues through a gap to the next track when a track ends', async () => {
    reportNearEnd('spotify:track:a');
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);

    // Poller picks up the near-end state, ticker detects the end -> gap.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(result.current.phase).toBe('gap');
    expect(result.current.gapRemaining).toBeLessThanOrEqual(2);

    // Run out the 2s gap -> advances and plays track b.
    playTrack.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_200);
    });
    expect(playTrack).toHaveBeenCalledWith('spotify:track:b', 'dev', 0);
    expect(result.current.index).toBe(1);
  });

  it('holds permanently between tracks when auto-continue is off', async () => {
    reportNearEnd('spotify:track:a');
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    act(() => result.current.setAutoContinue(false));
    await startAt(result, 0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(result.current.phase).toBe('held');
    expect(playTrack).toHaveBeenCalledTimes(1); // never advanced
  });

  it('ends after the last track with no gap', async () => {
    reportNearEnd('spotify:track:b');
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(result.current.phase).toBe('ended');
  });

  it('togglePlayPause pauses then resumes via the API', async () => {
    getPlaybackState.mockImplementation(async () => ({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'd',
      deviceName: 'Tablet',
      fetchedAt: Date.now(),
    }));
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);

    act(() => result.current.togglePlayPause());
    expect(pause).toHaveBeenCalled();
    expect(result.current.phase).toBe('paused');

    act(() => result.current.togglePlayPause());
    expect(resume).toHaveBeenCalled();
    expect(result.current.phase).toBe('playing');
  });

  it('holdNow() pauses playback and parks in "held"', async () => {
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    act(() => result.current.holdNow());
    expect(pause).toHaveBeenCalled();
    expect(result.current.phase).toBe('held');
  });
});
