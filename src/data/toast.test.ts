import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissToast, getToasts, subscribe, toast, TOAST_TTL_MS } from './toast';

// Clear any leftover toasts between tests (the store is module-level state).
afterEach(() => {
  for (const t of getToasts()) dismissToast(t.id);
  vi.useRealTimers();
});

describe('toast store', () => {
  it('adds a toast and notifies subscribers', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    const id = toast('boom');
    expect(getToasts()).toEqual([{ id, message: 'boom', level: 'error' }]);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('defaults to error level but accepts info', () => {
    toast('hi', 'info');
    expect(getToasts()[0].level).toBe('info');
  });

  it('returns a stable reference until the list changes', () => {
    toast('a');
    const snapshot = getToasts();
    expect(getToasts()).toBe(snapshot); // same ref → no spurious re-renders
    toast('b');
    expect(getToasts()).not.toBe(snapshot);
  });

  it('dismiss removes only the matching toast and notifies', () => {
    const id1 = toast('a');
    const id2 = toast('b');
    const listener = vi.fn();
    subscribe(listener);
    dismissToast(id1);
    expect(getToasts().map((t) => t.id)).toEqual([id2]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('dismissing an unknown id is a no-op (no notify)', () => {
    toast('a');
    const listener = vi.fn();
    subscribe(listener);
    dismissToast(9999);
    expect(listener).not.toHaveBeenCalled();
  });

  describe('auto-dismiss', () => {
    beforeEach(() => vi.useFakeTimers());

    it('removes the toast after the TTL', () => {
      toast('temp');
      expect(getToasts()).toHaveLength(1);
      vi.advanceTimersByTime(TOAST_TTL_MS);
      expect(getToasts()).toHaveLength(0);
    });
  });
});
