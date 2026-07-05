import { describe, it, expect } from 'vitest';
import { signaturesOf, isSignatureMove, primarySignature } from './signatureMoves';
import type { StepCalling } from './tracks';

const step = (name: string, measures = 1): StepCalling => ({ step: name, measures });

describe('signaturesOf', () => {
  it('matches a signature word inside a longer move name', () => {
    expect(signaturesOf('Butt Kick')).toEqual(['Kick']);
    expect(signaturesOf('Scissors Double')).toEqual(['Scissors']);
    expect(signaturesOf('Pony (4S - 2D)')).toEqual(['Pony']);
  });

  it('is case-insensitive and tolerates punctuation/extra spaces', () => {
    expect(signaturesOf('side to SIDE')).toEqual(['Side to side']);
    expect(signaturesOf('Side-to-Side')).toEqual(['Side to side']);
    expect(signaturesOf('REBOUND')).toEqual(['Rebound']);
  });

  it('matches word variants that contain the signature ("Stomping")', () => {
    expect(signaturesOf('Stomping')).toEqual(['Stomp']);
  });

  it('returns every signature a name contains', () => {
    expect(signaturesOf('Stomping Scissors Double')).toEqual(['Scissors', 'Stomp']);
    expect(signaturesOf('Stomp Side to Side')).toEqual(['Stomp', 'Side to side']);
  });

  it('returns nothing for non-signature moves and empty names', () => {
    expect(signaturesOf('Basic')).toEqual([]);
    expect(signaturesOf('Bounce Balance')).toEqual([]);
    expect(signaturesOf('')).toEqual([]);
  });
});

describe('isSignatureMove', () => {
  it('flags signature and non-signature names', () => {
    expect(isSignatureMove('Kick im V')).toBe(true);
    expect(isSignatureMove('Jogging')).toBe(false);
  });
});

describe('primarySignature', () => {
  it('picks the signature covering the most measures', () => {
    expect(
      primarySignature([step('Basic', 4), step('Kick', 2), step('Scissors', 3), step('Kick Double', 2)]),
    ).toBe('Kick');
  });

  it('credits every signature a combined step names', () => {
    // "Stomping Scissors" counts for both, so Scissors (2+1) beats Kick (2).
    expect(primarySignature([step('Kick', 2), step('Scissors', 2), step('Stomping Scissors', 1)])).toBe(
      'Scissors',
    );
  });

  it('merges name variants of the same signature into one entry', () => {
    // "Scissors" and "Scissors Double" are one Scissors bucket (2+2=4 > Kick 3)
    // — the chip shows the canonical label, never a specific variant name.
    expect(
      primarySignature([step('Scissors', 2), step('Scissors Double', 2), step('Kick', 3)]),
    ).toBe('Scissors');
  });

  it('breaks ties between different signatures by the signature list order', () => {
    expect(primarySignature([step('Pony', 2), step('Kick', 2)])).toBe('Kick');
    expect(primarySignature([step('Stomp', 4), step('Scissors', 4)])).toBe('Scissors');
  });

  it('returns null when no step is a signature move', () => {
    expect(primarySignature([step('Basic'), step('Jogging')])).toBeNull();
    expect(primarySignature([])).toBeNull();
  });
});
