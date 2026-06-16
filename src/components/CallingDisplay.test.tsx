import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Calling } from '../data/tracks';
import CallingDisplay from './CallingDisplay';

afterEach(cleanup);

const callings: Calling[] = [
  { time: 0, step: 'Jumping Jacks', cue: 'arms up' },
  { time: 10, step: 'High Knees' },
  { time: 20, step: 'Cooldown' },
];

describe('CallingDisplay', () => {
  it('shows the current step in NOW and the next step in NEXT', () => {
    render(<CallingDisplay callings={callings} positionSeconds={5} />);
    expect(screen.getByText('Jumping Jacks')).toBeTruthy();
    expect(screen.getByText('arms up')).toBeTruthy(); // the cue
    expect(screen.getByText('High Knees')).toBeTruthy();
    expect(screen.getByText('NEXT')).toBeTruthy();
  });

  it('renders a placeholder when nothing is active yet', () => {
    // Position before the first calling: no current step.
    const later: Calling[] = [{ time: 5, step: 'Jumping Jacks' }];
    render(<CallingDisplay callings={later} positionSeconds={0} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('shows "End of track" once past the last calling', () => {
    render(<CallingDisplay callings={callings} positionSeconds={25} />);
    expect(screen.getByText('Cooldown')).toBeTruthy(); // current
    expect(screen.getByText('End of track')).toBeTruthy(); // next
    expect(screen.getByText('✓')).toBeTruthy(); // ring at the end
  });

  it('falls back to a seconds countdown when no BPM is known', () => {
    render(<CallingDisplay callings={callings} positionSeconds={5} />);
    // secondsToNext = 5 → ceil(5) shown with an "s" unit, no count-in.
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('s')).toBeTruthy();
  });

  it('shows a beat-synced count-in and "CALL NOW" near a switch when BPM is set', () => {
    // position 9 → 1s to next; at 120 BPM that's 2 beats → count-in "1".
    const { container } = render(
      <CallingDisplay callings={callings} positionSeconds={9} bpm={120} />,
    );
    expect(screen.getByText('CALL NOW')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy(); // the count-in number
    expect(container.querySelector('.calling-display.announcing')).not.toBeNull();
    // No "s" unit while counting in beats.
    expect(screen.queryByText('s')).toBeNull();
  });

  it('is not announcing when the next switch is far away', () => {
    const { container } = render(
      <CallingDisplay callings={callings} positionSeconds={1} bpm={120} />,
    );
    expect(screen.queryByText('CALL NOW')).toBeNull();
    expect(container.querySelector('.calling-display.announcing')).toBeNull();
  });

  it('fills the countdown ring proportionally through the current segment', () => {
    const { container } = render(
      <CallingDisplay callings={callings} positionSeconds={5} />,
    );
    // Halfway between time 0 and time 10 → ~50% conic fill.
    const ring = container.querySelector('.ring') as HTMLElement;
    expect(ring.style.background).toContain('50%');
  });
});
