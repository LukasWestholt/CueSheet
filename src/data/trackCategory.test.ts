import { describe, it, expect } from 'vitest';
import { deriveCategory, categoryOf, MAIN_PART_MIN_BPM } from './trackCategory';
import type { StepCalling, Track } from './tracks';

const step = (name: string, measures = 4): StepCalling => ({ step: name, measures });
const BASIC = [step('Basic'), step('Jogging')];
const STOMPY = [step('Basic'), step('Stomping Scissors'), step('Kick')];

describe('deriveCategory', () => {
  it('returns null without a usable BPM', () => {
    expect(deriveCategory(null, BASIC)).toBeNull();
    expect(deriveCategory(undefined, BASIC)).toBeNull();
    expect(deriveCategory(0, BASIC)).toBeNull();
  });

  it('classifies below 112 BPM as warm-up / cool-down', () => {
    expect(deriveCategory(100, BASIC)).toBe('warmup');
    expect(deriveCategory(MAIN_PART_MIN_BPM - 0.5, BASIC)).toBe('warmup');
  });

  it('classifies 112+ BPM as main part', () => {
    expect(deriveCategory(MAIN_PART_MIN_BPM, BASIC)).toBe('main');
    expect(deriveCategory(130, BASIC)).toBe('main');
  });

  it('upgrades a main-part track with a stomp move to main part 2', () => {
    expect(deriveCategory(128, STOMPY)).toBe('main2');
    expect(deriveCategory(128, [step('Stomp Side to Side')])).toBe('main2');
    expect(deriveCategory(128, [step('Stomping')])).toBe('main2');
  });

  it('leaves a warm-up track with stomps as warm-up (stomps only split the main part)', () => {
    expect(deriveCategory(105, STOMPY)).toBe('warmup');
  });
});

describe('categoryOf', () => {
  const track = (overrides: Partial<Track>): Track => ({
    id: 't1',
    spotifyUri: 'spotify:track:0000000000000000000000',
    steps: BASIC,
    ...overrides,
  });

  it('lets an authored category override the derivation', () => {
    expect(categoryOf(track({ bpm: 100, category: 'main2' }))).toBe('main2');
    expect(categoryOf(track({ bpm: 130, category: 'warmup' }))).toBe('warmup');
  });

  it('derives from the authored BPM when no override is set', () => {
    expect(categoryOf(track({ bpm: 100 }))).toBe('warmup');
    expect(categoryOf(track({ bpm: 130, steps: STOMPY }))).toBe('main2');
  });

  it('uses the resolved BPM parameter over the authored one, and null when neither exists', () => {
    expect(categoryOf(track({}), 118)).toBe('main');
    expect(categoryOf(track({}))).toBeNull();
  });
});
