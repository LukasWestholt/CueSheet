// Per-track calibration the coach sets by ear (tap tempo + mark the downbeat),
// stored in localStorage keyed by Spotify URI. This replaces the deprecated
// Spotify audio-features/analysis endpoints for BPM and first beat.
import { readJSON, writeJSON, removeKey } from './storage';

export interface Calibration {
  bpm?: number;
  firstBeatSec?: number;
}

const KEY_PREFIX = 'tjf.cal.';

/**
 * Estimates BPM from a series of tap timestamps (ms) as the rounded inverse of
 * the average gap between consecutive taps. Needs at least two taps.
 */
export function bpmFromTaps(timestamps: number[]): number | null {
  if (timestamps.length < 2) return null;
  const sorted = [...timestamps].sort((a, b) => a - b);
  let sum = 0;
  for (let i = 1; i < sorted.length; i++) sum += sorted[i] - sorted[i - 1];
  const avgMs = sum / (sorted.length - 1);
  if (avgMs <= 0) return null;
  return Math.round(60_000 / avgMs);
}

export function loadCalibration(uri: string): Calibration | null {
  return readJSON<Calibration | null>(KEY_PREFIX + uri, null);
}

export function saveCalibration(uri: string, cal: Calibration): void {
  writeJSON(KEY_PREFIX + uri, cal);
}

export function clearCalibration(uri: string): void {
  removeKey(KEY_PREFIX + uri);
}
