import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHapticCue } from './useHapticCue';

const vibrate = vi.fn();

beforeEach(() => {
  vibrate.mockClear();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
});
afterEach(() => {
  // @ts-expect-error test-only cleanup of the stubbed property
  delete navigator.vibrate;
});

describe('useHapticCue', () => {
  it('vibrates on a step change, but not on mount', () => {
    const { rerender } = renderHook(({ row }) => useHapticCue(row, true), {
      initialProps: { row: 0 },
    });
    expect(vibrate).not.toHaveBeenCalled(); // mounting into a step is not a change
    rerender({ row: 1 });
    expect(vibrate).toHaveBeenCalledTimes(1);
    rerender({ row: 1 });
    expect(vibrate).toHaveBeenCalledTimes(1); // same row → no re-buzz
  });

  it('stays silent when disabled or before the first calling', () => {
    const { rerender } = renderHook(
      ({ row, on }) => useHapticCue(row, on),
      { initialProps: { row: 0, on: false } },
    );
    rerender({ row: 1, on: false });
    expect(vibrate).not.toHaveBeenCalled();
    rerender({ row: -1, on: true });
    expect(vibrate).not.toHaveBeenCalled();
  });
});
