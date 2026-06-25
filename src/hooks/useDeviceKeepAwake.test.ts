import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { getDevices, transferPlayback } = vi.hoisted(() => ({
  getDevices: vi.fn(),
  transferPlayback: vi.fn(),
}));
vi.mock('../spotify/api', () => ({ getDevices, transferPlayback }));

const { isLikelyLocalDevice } = vi.hoisted(() => ({
  isLikelyLocalDevice: vi.fn<() => boolean>(() => false),
}));
vi.mock('../spotify/localDevice', () => ({ isLikelyLocalDevice }));

const { loadKeepAwake } = vi.hoisted(() => ({ loadKeepAwake: vi.fn<() => boolean>(() => true) }));
vi.mock('../data/keepAwakeSetting', () => ({ loadKeepAwake }));

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
  transferPlayback.mockReset();
  transferPlayback.mockResolvedValue(undefined);
  isLikelyLocalDevice.mockReset();
  isLikelyLocalDevice.mockReturnValue(false);
  loadKeepAwake.mockReset();
  loadKeepAwake.mockReturnValue(true);
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

  it('does nothing — not even a device lookup — while inactive', async () => {
    renderHook(() => useDeviceKeepAwake('tab', false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getDevices).not.toHaveBeenCalled();
    expect(transferPlayback).not.toHaveBeenCalled();
  });

  it('skips when keep-awake is turned off in Settings', async () => {
    loadKeepAwake.mockReturnValue(false);
    getDevices.mockResolvedValue([device('tab', { is_active: true })]);
    renderHook(() => useDeviceKeepAwake('tab', true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(getDevices).not.toHaveBeenCalled();
  });

  it('falls back to the active device when none is explicitly selected', async () => {
    getDevices.mockResolvedValue([device('idle1'), device('act', { is_active: true })]);
    renderHook(() => useDeviceKeepAwake(null, true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(transferPlayback).toHaveBeenCalledWith('act', false);
  });

  it('re-asserts on every interval', async () => {
    getDevices.mockResolvedValue([device('tab')]);
    renderHook(() => useDeviceKeepAwake('tab', true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000); // mount + two 15s intervals
    });
    expect(transferPlayback.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
