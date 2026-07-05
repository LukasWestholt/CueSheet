import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import TimingFlow from './TimingFlow';
import type { StepCalling } from '../data/tracks';

const STEPS: StepCalling[] = [
  { step: 'Basic', measures: 4 },
  { step: 'Kick', measures: 2 },
];

const noop = () => {};

function flow(over: Partial<Parameters<typeof TimingFlow>[0]> = {}) {
  const props = {
    steps: STEPS,
    bpm: 120 as number | null,
    positionSeconds: 0,
    playing: true,
    error: null,
    onStart: noop,
    onApplyBpm: noop,
    onSaveFirstBeat: noop,
    onSaveTiming: noop,
    onClose: noop,
    ...over,
  };
  return { ...render(<TimingFlow {...props} />), props };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TimingFlow', () => {
  it('starts at the tempo stop when no BPM is known, and taps produce a usable BPM', () => {
    const onApplyBpm = vi.fn();
    const { getByText } = flow({ bpm: null, onApplyBpm });

    // 4 taps 500ms apart = 120 BPM.
    const times = [0, 500, 1000, 1500];
    let i = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => times[Math.min(i++, times.length - 1)]);
    const tapBtn = getByText('Tap the tempo').closest('button')!;
    for (let k = 0; k < 4; k++) fireEvent.click(tapBtn);

    fireEvent.click(getByText('Use 120 BPM'));
    expect(onApplyBpm).toHaveBeenCalledWith(120);
    // Advanced to the tap stop.
    expect(getByText(/Tap on count 1/)).toBeTruthy();
  });

  it('skips the tempo stop when a BPM is already known', () => {
    const { getByText, queryByText } = flow();
    expect(queryByText('Tap the tempo')).toBeNull();
    expect(getByText(/Tap on count 1 — Basic/)).toBeTruthy();
  });

  it('one tap on count 1 is enough for "Save first beat & done"', () => {
    const onSaveFirstBeat = vi.fn();
    const onClose = vi.fn();
    const { getByText, rerender, props } = flow({ positionSeconds: 1.234, onSaveFirstBeat, onClose });

    const save = getByText('Save first beat & done').closest('button')!;
    expect(save.hasAttribute('disabled')).toBe(true);

    fireEvent.click(getByText(/Tap on count 1/).closest('button')!);
    rerender(<TimingFlow {...props} positionSeconds={5} />);
    fireEvent.click(getByText('Save first beat & done'));
    expect(onSaveFirstBeat).toHaveBeenCalledWith(1.23); // rounded to 2 decimals
    expect(onClose).toHaveBeenCalled();
  });

  it('a full tap series saves first beat + measures', () => {
    const onSaveTiming = vi.fn();
    const { getByText, rerender, props } = flow({ positionSeconds: 1, onSaveTiming });

    // 120 BPM → one measure (8 beats) = 4s. Taps at 1s, 17s, 25s → 4 and 2 measures.
    const tapAt = (pos: number) => {
      rerender(<TimingFlow {...props} positionSeconds={pos} />);
      fireEvent.click(getByText(/Tap/, { selector: '.tap-big span' }).closest('button')!);
    };
    tapAt(1);
    tapAt(17);
    tapAt(25);

    fireEvent.click(getByText('Save timing'));
    expect(onSaveTiming).toHaveBeenCalledWith(1, [4, 2]);
  });

  it('caps at the first-beat tap when no BPM exists and the tempo stop was skipped', () => {
    const { getByText, queryByText } = flow({ bpm: null });
    fireEvent.click(getByText('Skip — first beat only'));
    expect(getByText(/0\/1$/)).toBeTruthy(); // one tap total
    expect(queryByText('Save timing')).toBeNull();
  });

  it('disables tapping until playback runs', () => {
    const { getByText } = flow({ playing: false });
    const big = getByText('Start playback first').closest('button')!;
    expect(big.hasAttribute('disabled')).toBe(true);
  });
});
