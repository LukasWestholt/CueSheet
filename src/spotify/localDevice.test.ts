import { describe, it, expect } from 'vitest';
import {
  isLikelyLocalDevice,
  deviceHintsFromUserAgent,
  deviceTypesFromUserAgent,
} from './localDevice';

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

describe('deviceTypesFromUserAgent', () => {
  it('maps mobile/desktop UAs to plausible Spotify types', () => {
    expect(deviceTypesFromUserAgent(ANDROID)).toEqual(['Smartphone']); // has "Mobile"
    expect(deviceTypesFromUserAgent(ANDROID_SAMSUNG)).toEqual(['Tablet', 'Smartphone']); // no "Mobile"
    expect(deviceTypesFromUserAgent(IPHONE)).toEqual(['Smartphone']);
    expect(deviceTypesFromUserAgent(DESKTOP)).toEqual(['Computer']);
  });
});

describe('isLikelyLocalDevice', () => {
  it('matches a Spotify device named after the Android model (type ignored)', () => {
    expect(isLikelyLocalDevice('Pixel 7', null, ANDROID)).toBe(true);
    expect(isLikelyLocalDevice("Lukas's Pixel", null, ANDROID)).toBe(true); // first-token match
    expect(isLikelyLocalDevice('SM-X700', null, ANDROID_SAMSUNG)).toBe(true);
  });

  it('matches an iPhone by platform keyword', () => {
    expect(isLikelyLocalDevice("Lukas's iPhone", 'Smartphone', IPHONE)).toBe(true);
  });

  it('falls back to device type when the name gives no hint (frozen Android UA)', () => {
    // Name "K"-less UA yields no name hint, but the active device is a phone.
    expect(isLikelyLocalDevice('Galaxy Tab', 'Smartphone', ANDROID_FROZEN)).toBe(true);
    expect(isLikelyLocalDevice('Galaxy Tab', 'Tablet', ANDROID_FROZEN)).toBe(false); // frozen UA has "Mobile" → Smartphone only
  });

  it('does not let type match a different device class', () => {
    expect(isLikelyLocalDevice('Living Room', 'Speaker', ANDROID_FROZEN)).toBe(false);
    expect(isLikelyLocalDevice('Desk PC', 'Computer', IPHONE)).toBe(false);
  });

  it('rejects an unrelated device when neither name nor type matches', () => {
    expect(isLikelyLocalDevice('Living Room Speaker', 'Speaker', ANDROID)).toBe(false);
    expect(isLikelyLocalDevice('Office iMac', 'Computer', IPHONE)).toBe(false);
  });

  it('is false when name has no hint and no type is given', () => {
    expect(isLikelyLocalDevice('Pixel 7', null, ANDROID_FROZEN)).toBe(false);
    expect(isLikelyLocalDevice('Some Computer', null, DESKTOP)).toBe(false);
  });

  it('is false for an empty device name with no type', () => {
    expect(isLikelyLocalDevice(null, null, ANDROID)).toBe(false);
    expect(isLikelyLocalDevice('', null, ANDROID)).toBe(false);
  });
});
