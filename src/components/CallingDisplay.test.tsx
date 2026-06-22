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

  it('announces the move (→, not "1") in the final beats of the close', () => {
    // position 9 → 1s to next; at 120 BPM that's 2 beats → the "1" beat, which
    // we replace with the move announcement rather than a counted "1".
    const { container } = render(
      <CallingDisplay callings={callings} positionSeconds={9} bpm={120} />,
    );
    expect(screen.getByText('CALL NOW')).toBeTruthy();
    expect(screen.getByText('→')).toBeTruthy(); // move announce, not "1"
    expect(screen.queryByText('1')).toBeNull();
    expect(container.querySelector('.calling-display.announcing')).not.toBeNull();
    // No "s" unit while counting in beats.
    expect(screen.queryByText('s')).toBeNull();
  });

  it('shows the closing "4 3 2" count and "CALL NOW"', () => {
    // 8 beats to next at 120 BPM = 4s out → position 6 → "4".
    render(<CallingDisplay callings={callings} positionSeconds={6} bpm={120} />);
    expect(screen.getByText('CALL NOW')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('shows the running human 8-count mid-step (no "CALL NOW")', () => {
    // position 0.5 → 9.5s to next: running count. At 120 BPM that's 1 beat in →
    // count "2".
    render(<CallingDisplay callings={callings} positionSeconds={0.5} bpm={120} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText('CALL NOW')).toBeNull();
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
