import { describe, it, expect } from 'vitest';
import { bpmFromTaps } from './calibration';

describe('bpmFromTaps', () => {
  it('needs at least two taps', () => {
    expect(bpmFromTaps([])).toBeNull();
    expect(bpmFromTaps([1000])).toBeNull();
  });

  it('computes BPM from the average gap', () => {
    // 500ms between taps -> 120 BPM.
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
    // 600ms -> 100 BPM.
    expect(bpmFromTaps([0, 600])).toBe(100);
  });

  it('averages uneven taps and rounds', () => {
    // gaps 480, 500, 520 -> avg 500 -> 120.
    expect(bpmFromTaps([0, 480, 980, 1500])).toBe(120);
  });

  it('is order-independent', () => {
    expect(bpmFromTaps([1500, 0, 1000, 500])).toBe(120);
  });

  it('handles a realistic 128 BPM tap (~469ms)', () => {
    const gap = 60_000 / 128;
    expect(bpmFromTaps([0, gap, gap * 2, gap * 3])).toBe(128);
  });
});
