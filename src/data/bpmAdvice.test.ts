import { describe, it, expect } from 'vitest';
import { bpmAdvice, bpmLevelClass } from './bpmAdvice';

describe('bpmAdvice', () => {
  it('classifies the jumping-fitness bands', () => {
    expect(bpmAdvice(90).level).toBe('too-slow');
    expect(bpmAdvice(94).level).toBe('too-slow');
    expect(bpmAdvice(95).level).toBe('slow');
    expect(bpmAdvice(114).level).toBe('slow');
    expect(bpmAdvice(115).level).toBe('ideal');
    expect(bpmAdvice(124).level).toBe('ideal');
    expect(bpmAdvice(125).level).toBe('ideal');
    expect(bpmAdvice(130).level).toBe('ideal');
    expect(bpmAdvice(131).level).toBe('fast');
    expect(bpmAdvice(140).level).toBe('fast');
    expect(bpmAdvice(141).level).toBe('too-fast');
    expect(bpmAdvice(180).level).toBe('too-fast');
  });

  it('flags 125–130 as the main-part-2 band', () => {
    expect(bpmAdvice(124).label).not.toContain('main part 2');
    expect(bpmAdvice(125).label).toContain('main part 2');
    expect(bpmAdvice(130).label).toContain('main part 2');
  });

  it('handles missing/zero bpm', () => {
    expect(bpmAdvice(0).level).toBe('too-slow');
  });

  it('maps levels to color classes', () => {
    expect(bpmLevelClass('ideal')).toBe('bpm-ok');
    expect(bpmLevelClass('slow')).toBe('bpm-warn');
    expect(bpmLevelClass('fast')).toBe('bpm-warn');
    expect(bpmLevelClass('too-slow')).toBe('bpm-bad');
    expect(bpmLevelClass('too-fast')).toBe('bpm-bad');
  });
});
