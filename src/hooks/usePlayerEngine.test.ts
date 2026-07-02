import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Track } from '../data/tracks';
import type { PlaybackSnapshot } from '../spotify/api';

// Mocked Spotify API (hoisted so the vi.mock factory can reference it).
const { playTrack, pause, resume, getPlaybackState, getDevices, transferPlayback, setVolume } = vi.hoisted(() => ({
  playTrack: vi.fn(async () => {}),
  pause: vi.fn(async () => {}),
  resume: vi.fn(async () => {}),
  getPlaybackState: vi.fn<() => Promise<PlaybackSnapshot | null>>(),
  getDevices: vi.fn(async () => [] as { id: string; name: string; is_active: boolean }[]),
  transferPlayback: vi.fn(async () => {}),
  setVolume: vi.fn(async () => {}),
}));
vi.mock('../spotify/api', () => ({
  playTrack,
  pause,
  resume,
  getPlaybackState,
  getDevices,
  transferPlayback,
  setVolume,
}));

// Keep-awake override (null = follow the device heuristic) + method. Controlled
// per test instead of localStorage, which jsdom doesn't provide.
const { loadKeepAwakeOverride, loadKeepAwakeMethod, loadSilentTrackUri, saveKeepAwakeMethod } =
  vi.hoisted(() => ({
    loadKeepAwakeOverride: vi.fn<() => boolean | null>(() => null),
    loadKeepAwakeMethod: vi.fn<() => 'ping' | 'silent'>(() => 'ping'),
    loadSilentTrackUri: vi.fn<() => string>(() => 'spotify:track:silentdefault0000000000'),
    saveKeepAwakeMethod: vi.fn<(m: 'ping' | 'silent') => void>(),
  }));
vi.mock('../data/keepAwakeSetting', () => ({
  loadKeepAwakeOverride,
  loadKeepAwakeMethod,
  loadSilentTrackUri,
  saveKeepAwakeMethod,
}));

import { usePlayerEngine } from './usePlayerEngine';

const tracks: Track[] = [
  { id: 'a', title: 'A', artist: 'x', spotifyUri: 'spotify:track:a', durationMs: 10_000, steps: [] },
  { id: 'b', title: 'B', artist: 'x', spotifyUri: 'spotify:track:b', durationMs: 10_000, steps: [] },
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
    deviceType: null,
    volumePercent: null,    fetchedAt: Date.now(),
  }));
}

async function startAt(result: { current: ReturnType<typeof usePlayerEngine> }, i: number) {
  await act(async () => {
    result.current.start(i);
    await vi.advanceTimersByTimeAsync(5); // flush the playTrack() microtask
  });
}

// The keep-awake heuristic reads navigator.userAgent; stub it per test.
const REAL_UA = navigator.userAgent;
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const ANDROID_FROZEN_UA =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  playTrack.mockClear();
  pause.mockClear();
  resume.mockClear();
  getPlaybackState.mockReset();
  getPlaybackState.mockResolvedValue(null);
  getDevices.mockReset();
  getDevices.mockResolvedValue([]);
  transferPlayback.mockClear();
  loadKeepAwakeOverride.mockReset();
  loadKeepAwakeOverride.mockReturnValue(null);
  loadKeepAwakeMethod.mockReset();
  loadKeepAwakeMethod.mockReturnValue('ping');
  loadSilentTrackUri.mockReset();
  loadSilentTrackUri.mockReturnValue('spotify:track:silentdefault0000000000');
});

afterEach(() => {
  vi.useRealTimers();
  setUserAgent(REAL_UA);
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

  it('extendGap adds time to the countdown and delays the advance', async () => {
    reportNearEnd('spotify:track:a');
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(result.current.phase).toBe('gap');

    // Two presses of +5s extend the 2s gap well past its original deadline.
    act(() => {
      result.current.extendGap(5);
      result.current.extendGap(5);
    });
    expect(result.current.gapRemaining).toBeGreaterThan(2);

    // Past the original 2s deadline it must still be waiting, not advanced.
    playTrack.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });
    expect(result.current.phase).toBe('gap');
    expect(playTrack).not.toHaveBeenCalled();
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

  it('seekTo during a hold restarts the displayed track at that position', async () => {
    reportNearEnd('spotify:track:a');
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    act(() => result.current.setAutoContinue(false));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(result.current.phase).toBe('held');

    // Tapping a step between tracks must re-play the track from there — a raw
    // seek would target a dead (or silent keep-awake) playback.
    playTrack.mockClear();
    await act(async () => {
      result.current.seekTo(5_000);
      await vi.advanceTimersByTimeAsync(5);
    });
    expect(playTrack).toHaveBeenCalledWith('spotify:track:a', 'dev', 5_000);
    expect(result.current.phase).toBe('playing');
    expect(result.current.index).toBe(0);
  });

  it('ends after the last track with no gap', async () => {
    reportNearEnd('spotify:track:b');
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(result.current.phase).toBe('ended');
    // Must stop playback so Spotify doesn't loop/autoplay the finished track.
    expect(pause).toHaveBeenCalled();
  });

  it('togglePlayPause pauses then resumes via the API', async () => {
    getPlaybackState.mockImplementation(async () => ({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'd',
      deviceName: 'Tablet',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
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

  it('prev restarts the current track, then jumps back on a quick second press', async () => {
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 1);

    playTrack.mockClear();
    await act(async () => {
      result.current.prev();
      await vi.advanceTimersByTimeAsync(5);
    });
    // First press restarts the current track (index 1).
    expect(playTrack).toHaveBeenLastCalledWith('spotify:track:b', 'dev', 0);
    expect(result.current.index).toBe(1);

    await act(async () => {
      result.current.prev();
      await vi.advanceTimersByTimeAsync(5);
    });
    // Quick second press goes to the previous track (index 0).
    expect(playTrack).toHaveBeenLastCalledWith('spotify:track:a', 'dev', 0);
    expect(result.current.index).toBe(0);
  });

  it('holdNow() pauses playback and parks in "held"', async () => {
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    act(() => result.current.holdNow());
    expect(pause).toHaveBeenCalled();
    expect(result.current.phase).toBe('held');
  });

  it('flags the device as lost after repeated empty polls', async () => {
    // Default getPlaybackState resolves null (no active device).
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    expect(result.current.noDevice).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500); // two empty polls
    });
    expect(result.current.noDevice).toBe(true);
  });

  it('recover() re-acquires a device and resumes the current track', async () => {
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });
    expect(result.current.noDevice).toBe(true);

    getDevices.mockResolvedValue([{ id: 'tablet', name: 'Tablet', is_active: true }]);
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 0,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'tablet',
      deviceName: 'Tablet',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    });
    playTrack.mockClear();
    await act(async () => {
      result.current.recover();
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(playTrack).toHaveBeenCalledWith('spotify:track:a', 'tablet', 0);
    expect(result.current.noDevice).toBe(false);
  });

  it('flags a hijack when the device plays a different track than ours', async () => {
    // Spotify reports a foreign track while we expect spotify:track:a.
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 5_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:intruder',
      deviceId: 'd',
      deviceName: 'Tablet',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    });
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    expect(result.current.hijacked).toBe(false);

    // Needs a few consecutive wrong-track polls before it's declared.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_500);
    });
    expect(result.current.hijacked).toBe(true);
    expect(result.current.noDevice).toBe(false);
  });

  it('recover() takes back control and clears a hijack', async () => {
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 5_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:intruder',
      deviceId: 'd',
      deviceName: 'Tablet',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    });
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_500);
    });
    expect(result.current.hijacked).toBe(true);

    getDevices.mockResolvedValue([{ id: 'tablet', name: 'Tablet', is_active: true }]);
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 0,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'tablet',
      deviceName: 'Tablet',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    });
    playTrack.mockClear();
    await act(async () => {
      result.current.recover();
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(playTrack).toHaveBeenCalledWith('spotify:track:a', 'tablet', expect.any(Number));
    expect(result.current.hijacked).toBe(false);
  });

  it('treats an end-of-track auto-advance as the gap, not a hijack', async () => {
    // Our track 'a' at 8s of 10s, re-reported each poll so the interpolated ticker
    // stays under the 500ms end-guard (never auto-fires) but climbs into the 1.5s
    // auto-advance window (>=8.5s) by the next poll.
    let uri = 'spotify:track:a';
    getPlaybackState.mockImplementation(async () => ({
      isPlaying: true,
      progressMs: 8_000,
      durationMs: 10_000,
      trackUri: uri,
      deviceId: 'd',
      deviceName: 'Tablet',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    }));
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);

    // One poll establishes the near-end snapshot for our track.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.phase).toBe('playing');

    // Spotify auto-advances to a different track at the end.
    uri = 'spotify:track:autoplayed';
    pause.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    // Recovered into the normal gap (track 0 has a next), not flagged as a hijack.
    expect(result.current.phase).toBe('gap');
    expect(result.current.hijacked).toBe(false);
    expect(pause).toHaveBeenCalled(); // enterGapOrEnd stopped the autoplayed track
  });

  it('treats a repeat=track loop (same track restarting near the end) as the gap', async () => {
    // Same trick: 'a' re-reported at 8s keeps the ticker below the end-guard while
    // the last snapshot climbs into the near-end window; then the track restarts.
    let progressMs = 8_000;
    getPlaybackState.mockImplementation(async () => ({
      isPlaying: true,
      progressMs,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'd',
      deviceName: 'Tablet',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    }));
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.phase).toBe('playing');

    // repeat=track restarts the same track from the top instead of stopping.
    progressMs = 0;
    pause.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.phase).toBe('gap');
    expect(result.current.hijacked).toBe(false);
    expect(pause).toHaveBeenCalled();
  });

  it('defaults keep-awake on via device type when the UA gives no name hint', async () => {
    setUserAgent(ANDROID_FROZEN_UA); // model frozen to "K" → no name hint
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'd',
      deviceName: 'Galaxy Tab', // doesn't match the UA by name
      deviceType: 'Smartphone', // …but the type matches an Android mobile UA
      volumePercent: null,
      fetchedAt: Date.now(),
    });
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    expect(result.current.keepAwake).toBe(true); // rescued by the type fallback
  });

  it('keeps the device awake while held when it looks like this machine (UA heuristic)', async () => {
    setUserAgent(ANDROID_UA); // model "Pixel 7"
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'd',
      deviceName: 'Pixel 7',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([{ id: 'd', name: 'Pixel 7', is_active: false }]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    // The active device matches this UA → flagged as our keep-awake device.
    expect(result.current.keepAwake).toBe(true); // default on for our own device

    await act(async () => {
      result.current.holdNow();
    });
    expect(result.current.phase).toBe('held');
    transferPlayback.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(transferPlayback).toHaveBeenCalledWith('d', false);
  });

  it('does not keep alive a device that is not this machine', async () => {
    setUserAgent(ANDROID_UA);
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'spk',
      deviceName: 'Living Room Speaker',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([{ id: 'spk', name: 'Living Room Speaker', is_active: true }]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    expect(result.current.keepAwake).toBe(false); // default off — not our device

    await act(async () => {
      result.current.holdNow();
    });
    transferPlayback.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(transferPlayback).not.toHaveBeenCalled();
  });

  it('an explicit override forces keep-alive on even for a non-local device', async () => {
    setUserAgent(ANDROID_UA);
    loadKeepAwakeOverride.mockReturnValue(true); // coach forced it on in Settings
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'spk',
      deviceName: 'Living Room Speaker',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([{ id: 'spk', name: 'Living Room Speaker', is_active: true }]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    expect(result.current.keepAwake).toBe(true); // override wins over the heuristic

    await act(async () => {
      result.current.holdNow();
    });
    transferPlayback.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(transferPlayback).toHaveBeenCalledWith('spk', false);
  });

  it('plays a silent track (not a ping) between tracks when the method is "silent"', async () => {
    setUserAgent(ANDROID_UA);
    loadKeepAwakeOverride.mockReturnValue(true);
    loadKeepAwakeMethod.mockReturnValue('silent');
    loadSilentTrackUri.mockReturnValue('spotify:track:silent123');
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'spk',
      deviceName: 'Living Room Speaker',
      deviceType: null,
      volumePercent: null,
      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([{ id: 'spk', name: 'Living Room Speaker', is_active: true }]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    await act(async () => {
      result.current.holdNow(); // pause permanently between tracks → 'held'
    });
    playTrack.mockClear();
    transferPlayback.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(playTrack).toHaveBeenCalledWith('spotify:track:silent123', 'spk');
    expect(transferPlayback).not.toHaveBeenCalled();
  });

  it('still pings (no silent track) on a mid-track pause even in "silent" mode', async () => {
    setUserAgent(ANDROID_UA);
    loadKeepAwakeOverride.mockReturnValue(true);
    loadKeepAwakeMethod.mockReturnValue('silent');
    loadSilentTrackUri.mockReturnValue('spotify:track:silent123');
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 600_000, // long track so it never ends during the test
      trackUri: 'spotify:track:a',
      deviceId: 'spk',
      deviceName: 'Living Room Speaker',
      deviceType: null,
      volumePercent: null,
      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([{ id: 'spk', name: 'Living Room Speaker', is_active: true }]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
      result.current.togglePlayPause(); // pause mid-track → 'paused'
    });
    expect(result.current.phase).toBe('paused');
    playTrack.mockClear();
    transferPlayback.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(transferPlayback).toHaveBeenCalledWith('spk', false);
    expect(playTrack).not.toHaveBeenCalled();
  });

  it('starts the keep-awake silent track promptly on entering held (no 15s wait)', async () => {
    loadKeepAwakeOverride.mockReturnValue(true);
    loadKeepAwakeMethod.mockReturnValue('silent');
    loadSilentTrackUri.mockReturnValue('spotify:track:silent123');
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'spk',
      deviceName: 'Living Room Speaker',
      deviceType: null,
      volumePercent: null,
      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([{ id: 'spk', name: 'Living Room Speaker', is_active: true }]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    playTrack.mockClear();
    await act(async () => {
      result.current.holdNow();
    });
    // Past the ~1s kickoff but far short of the 15s steady-state interval.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(playTrack).toHaveBeenCalledWith('spotify:track:silent123', 'spk');
  });

  it('setKeepAwakeMethod("ping") persists and stops the silent track at once', async () => {
    loadKeepAwakeOverride.mockReturnValue(true);
    loadKeepAwakeMethod.mockReturnValue('silent');
    loadSilentTrackUri.mockReturnValue('spotify:track:silent123');
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'spk',
      deviceName: 'Living Room Speaker',
      deviceType: null,
      volumePercent: null,
      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([{ id: 'spk', name: 'Living Room Speaker', is_active: true }]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    await act(async () => {
      result.current.holdNow(); // between tracks, silent track playing
    });
    transferPlayback.mockClear();
    await act(async () => {
      result.current.setKeepAwakeMethod('ping');
      await vi.advanceTimersByTimeAsync(5); // flush the immediate re-assert
    });
    expect(saveKeepAwakeMethod).toHaveBeenCalledWith('ping');
    expect(result.current.keepAwakeMethod).toBe('ping');
    expect(transferPlayback).toHaveBeenCalledWith('spk', false); // paused the silent track
  });

  it('keeps the selected device warm before the first track (idle / detail view)', async () => {
    getDevices.mockResolvedValue([
      { id: 'dev', name: 'Tablet', is_active: false },
    ]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await act(async () => {
      result.current.select(0); // detail page: idle, not yet playing
    });
    expect(result.current.phase).toBe('idle');
    transferPlayback.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    // No name learned yet → it targets the explicitly-selected device id.
    expect(transferPlayback).toHaveBeenCalledWith('dev', false);
  });

  it('does not keep awake in idle when keep-awake is explicitly off', async () => {
    loadKeepAwakeOverride.mockReturnValue(false); // coach turned it off in Settings
    getDevices.mockResolvedValue([
      { id: 'dev', name: 'Tablet', is_active: false },
    ]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await act(async () => {
      result.current.select(0);
    });
    transferPlayback.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(transferPlayback).not.toHaveBeenCalled();
  });

  it('does not ping while playing', async () => {
    setUserAgent(ANDROID_UA);
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 600_000, // long track so it never ends during the test
      trackUri: 'spotify:track:a',
      deviceId: 'd',
      deviceName: 'Pixel 7',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([{ id: 'd', name: 'Pixel 7', is_active: true }]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    transferPlayback.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(result.current.phase).toBe('playing');
    expect(transferPlayback).not.toHaveBeenCalled();
  });

  it('flags the keep-awake device asleep when it drops, and recovers on recheck', async () => {
    setUserAgent(ANDROID_UA);
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 10_000,
      trackUri: 'spotify:track:a',
      deviceId: 'd',
      deviceName: 'Pixel 7',
      deviceType: null,
      volumePercent: null,      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([{ id: 'd', name: 'Pixel 7', is_active: false }]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    await act(async () => result.current.holdNow());

    // The device drops off Connect → the keep-alive check can't find it.
    getDevices.mockResolvedValue([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(result.current.deviceAsleep).toBe(true);

    // It comes back (with a fresh id); a manual recheck re-asserts it.
    getDevices.mockResolvedValue([{ id: 'd2', name: 'Pixel 7', is_active: false }]);
    transferPlayback.mockClear();
    await act(async () => {
      result.current.recheckDevice();
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.deviceAsleep).toBe(false);
    expect(transferPlayback).toHaveBeenCalledWith('d2', false);
  });

  it('stops polling /me/player once the device is lost, then reconnects when it returns', async () => {
    getPlaybackState.mockResolvedValue(null); // no active device
    getDevices.mockResolvedValue([]);
    const { result } = renderHook(() => usePlayerEngine(tracks, 'dev', 2));
    await startAt(result, 0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500); // two empty polls → device lost
    });
    expect(result.current.noDevice).toBe(true);

    // While lost we watch /devices, not /me/player.
    getPlaybackState.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(getPlaybackState).not.toHaveBeenCalled();

    // Device returns → auto-reconnect (replays the current track on it).
    getDevices.mockResolvedValue([{ id: 'd', name: 'Tablet', is_active: true }]);
    playTrack.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    expect(playTrack).toHaveBeenCalledWith('spotify:track:a', 'd', expect.any(Number));
  });
});
