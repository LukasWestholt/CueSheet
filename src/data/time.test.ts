import { describe, it, expect } from 'vitest';
import { formatClock, formatLong } from './time';

describe('formatClock', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9000)).toBe('0:09');
    expect(formatClock(215000)).toBe('3:35');
    expect(formatClock(600000)).toBe('10:00');
  });

  it('rounds to the nearest second and clamps negatives to 0', () => {
    expect(formatClock(1499)).toBe('0:01');
    expect(formatClock(1500)).toBe('0:02');
    expect(formatClock(-5000)).toBe('0:00');
  });
});

describe('formatLong', () => {
  it('omits the hours field under an hour', () => {
    expect(formatLong(0)).toBe('0:00');
    expect(formatLong(215000)).toBe('3:35');
    expect(formatLong(3599000)).toBe('59:59');
  });

  it('adds an hours field and zero-pads minutes past an hour', () => {
    expect(formatLong(3600000)).toBe('1:00:00');
    expect(formatLong(3725000)).toBe('1:02:05');
    expect(formatLong(7384000)).toBe('2:03:04');
  });
});
