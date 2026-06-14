import { describe, it, expect } from 'vitest';
import { bpmAdvice, bpmLevelClass } from './bpmAdvice';

describe('bpmAdvice', () => {
  it('classifies the jumping-fitness bands', () => {
    expect(bpmAdvice(90).level).toBe('too-slow');
    expect(bpmAdvice(114).level).toBe('too-slow');
    expect(bpmAdvice(115).level).toBe('slow');
    expect(bpmAdvice(127).level).toBe('slow');
    expect(bpmAdvice(128).level).toBe('ideal');
    expect(bpmAdvice(135).level).toBe('ideal');
    expect(bpmAdvice(140).level).toBe('ideal');
    expect(bpmAdvice(141).level).toBe('fast');
    expect(bpmAdvice(155).level).toBe('fast');
    expect(bpmAdvice(156).level).toBe('too-fast');
    expect(bpmAdvice(180).level).toBe('too-fast');
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
