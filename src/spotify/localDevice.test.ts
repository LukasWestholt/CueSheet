import { describe, it, expect } from 'vitest';
import { isLikelyLocalDevice, deviceHintsFromUserAgent } from './localDevice';

const ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const ANDROID_SAMSUNG = 'Mozilla/5.0 (Linux; Android 13; SM-X700 Build/TP1A.220624.014) AppleWebKit/537.36';
const ANDROID_FROZEN = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120';

describe('deviceHintsFromUserAgent', () => {
  it('extracts the Android model and its first token', () => {
    expect(deviceHintsFromUserAgent(ANDROID)).toEqual(['Pixel 7', 'Pixel']);
    expect(deviceHintsFromUserAgent(ANDROID_SAMSUNG)).toEqual(['SM-X700']);
  });

  it('ignores a privacy-frozen Android model ("K")', () => {
    expect(deviceHintsFromUserAgent(ANDROID_FROZEN)).toEqual([]);
  });

  it('emits the platform keyword on iOS', () => {
    expect(deviceHintsFromUserAgent(IPHONE)).toEqual(['iPhone']);
  });

  it('derives nothing usable from a desktop UA', () => {
    expect(deviceHintsFromUserAgent(DESKTOP)).toEqual([]);
  });
});

describe('isLikelyLocalDevice', () => {
  it('matches a Spotify device named after the Android model', () => {
    expect(isLikelyLocalDevice('Pixel 7', ANDROID)).toBe(true);
    expect(isLikelyLocalDevice("Lukas's Pixel", ANDROID)).toBe(true); // first-token match
    expect(isLikelyLocalDevice('SM-X700', ANDROID_SAMSUNG)).toBe(true);
  });

  it('matches an iPhone by platform keyword', () => {
    expect(isLikelyLocalDevice("Lukas's iPhone", IPHONE)).toBe(true);
  });

  it('rejects an unrelated device', () => {
    expect(isLikelyLocalDevice('Living Room Speaker', ANDROID)).toBe(false);
    expect(isLikelyLocalDevice('Office iMac', IPHONE)).toBe(false);
  });

  it('is false when no hints can be derived (frozen UA / desktop)', () => {
    expect(isLikelyLocalDevice('Pixel 7', ANDROID_FROZEN)).toBe(false);
    expect(isLikelyLocalDevice('Some Computer', DESKTOP)).toBe(false);
  });

  it('is false for an empty device name', () => {
    expect(isLikelyLocalDevice(null, ANDROID)).toBe(false);
    expect(isLikelyLocalDevice('', ANDROID)).toBe(false);
  });
});
