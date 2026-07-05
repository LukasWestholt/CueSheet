import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { getDevices, getPlaybackState, playTrack, transferPlayback } = vi.hoisted(() => ({
  getDevices: vi.fn(),
  getPlaybackState: vi.fn(),
  playTrack: vi.fn(),
  transferPlayback: vi.fn(),
}));
vi.mock('../spotify/api', () => ({ getDevices, getPlaybackState, playTrack, transferPlayback }));

const { loadKeepAwake, loadKeepAwakeMethod, loadSilentTrackUri } = vi.hoisted(() => ({
  loadKeepAwake: vi.fn<() => boolean>(() => true),
  loadKeepAwakeMethod: vi.fn<() => 'ping' | 'silent'>(() => 'ping'),
  loadSilentTrackUri: vi.fn<() => string>(() => 'spotify:track:silent123'),
}));
vi.mock('../data/keepAwakeSetting', () => ({
  loadKeepAwake,
  loadKeepAwakeMethod,
  loadSilentTrackUri,
}));

import { useDeviceKeepAwake } from './useDeviceKeepAwake';

const device = (id: string, extra: Partial<{ is_active: boolean }> = {}) => ({
  id,
  name: id,
  type: 'Tablet',
  is_active: false,
  volume_percent: null,
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  getDevices.mockReset();
  getDevices.mockResolvedValue([]);
  getPlaybackState.mockReset();
  getPlaybackState.mockResolvedValue(null); // nothing playing by default
  transferPlayback.mockReset();
  transferPlayback.mockResolvedValue(undefined);
  playTrack.mockReset();
  playTrack.mockResolvedValue(undefined);
  loadKeepAwake.mockReset();
  loadKeepAwake.mockReturnValue(true);
  loadKeepAwakeMethod.mockReset();
  loadKeepAwakeMethod.mockReturnValue('ping');
  loadSilentTrackUri.mockReset();
  loadSilentTrackUri.mockReturnValue('spotify:track:silent123');
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useDeviceKeepAwake', () => {
  it('pings the explicitly-selected device while active', async () => {
    getDevices.mockResolvedValue([device('tab'), device('other')]);
    renderHook(() => useDeviceKeepAwake('tab', true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1); // the immediate ping on mount
    });
    expect(transferPlayback).toHaveBeenCalledWith('tab', false);
  });

  it('does nothing — not even a device lookup — without a selected device', async () => {
    getDevices.mockResolvedValue([device('act', { is_active: true })]);
    renderHook(() => useDeviceKeepAwake(null, true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getDevices).not.toHaveBeenCalled();
    expect(transferPlayback).not.toHaveBeenCalled();
  });

  it('never pauses a live track — skips the ping while playback is active', async () => {
    // The coach left a track playing and walked back to the list.
    getPlaybackState.mockResolvedValue({
      isPlaying: true,
      progressMs: 1_000,
      durationMs: 60_000,
      trackUri: 'spotify:track:a',
      deviceId: 'tab',
      deviceName: 'tab',
      deviceType: 'Tablet',
      volumePercent: 50,
      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([device('tab', { is_active: true })]);
    renderHook(() => useDeviceKeepAwake('tab', true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000); // several ticks
    });
    expect(transferPlayback).not.toHaveBeenCalled(); // would have paused the track
  });

  it('does nothing while inactive (the player view owns the device)', async () => {
    renderHook(() => useDeviceKeepAwake('tab', false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getDevices).not.toHaveBeenCalled();
    expect(transferPlayback).not.toHaveBeenCalled();
  });

  it('does not transfer to the selected device when it is gone from Connect', async () => {
    getDevices.mockResolvedValue([device('other')]); // 'tab' not present
    renderHook(() => useDeviceKeepAwake('tab', true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(transferPlayback).not.toHaveBeenCalled();
  });

  it('skips when keep-awake is turned off in Settings', async () => {
    loadKeepAwake.mockReturnValue(false);
    getDevices.mockResolvedValue([device('tab')]);
    renderHook(() => useDeviceKeepAwake('tab', true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(getDevices).not.toHaveBeenCalled();
  });

  it('re-asserts on every interval', async () => {
    getDevices.mockResolvedValue([device('tab')]);
    renderHook(() => useDeviceKeepAwake('tab', true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000); // mount + two 15s intervals
    });
    expect(transferPlayback.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('plays the silent track instead of pinging when the method is "silent"', async () => {
    // A ping keeps the device on Connect but the Bluetooth speaker still drops
    // — the list screen must hold it exactly like the player does.
    loadKeepAwakeMethod.mockReturnValue('silent');
    getDevices.mockResolvedValue([device('tab')]);
    renderHook(() => useDeviceKeepAwake('tab', true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1); // immediate tick on activation
    });
    expect(playTrack).toHaveBeenCalledWith('spotify:track:silent123', 'tab');
    expect(transferPlayback).not.toHaveBeenCalled();
  });

  it('does not restart a silent track that is already playing', async () => {
    loadKeepAwakeMethod.mockReturnValue('silent');
    getPlaybackState.mockResolvedValue({
      isPlaying: true, // the silent track already holds the device
      progressMs: 60_000,
      durationMs: 600_000,
      trackUri: 'spotify:track:silent123',
      deviceId: 'tab',
      deviceName: 'tab',
      deviceType: 'Tablet',
      volumePercent: 50,
      fetchedAt: Date.now(),
    });
    getDevices.mockResolvedValue([device('tab', { is_active: true })]);
    renderHook(() => useDeviceKeepAwake('tab', true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(playTrack).not.toHaveBeenCalled();
    expect(transferPlayback).not.toHaveBeenCalled();
  });
});
