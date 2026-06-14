import type { Track } from './tracks';

/** Values that can be fetched from Spotify (null = unknown / not yet loaded). */
export interface FetchedMeta {
  title: string | null;
  artist: string | null;
  durationMs: number | null;
  bpm: number | null;
  firstBeatSec: number | null;
}

/** The metadata the UI actually renders, after applying authored overrides. */
export interface ResolvedMeta {
  title: string;
  artist: string;
  durationMs: number;
  /** null while still unknown — callings stay empty until a BPM is available. */
  bpm: number | null;
  firstBeatSec: number;
}

/**
 * Resolves the metadata to display: an authored value on the Track always wins;
 * otherwise the value fetched from Spotify is used; otherwise a safe default.
 */
export function resolveTrackMeta(track: Track, fetched: Partial<FetchedMeta>): ResolvedMeta {
  return {
    title: track.title ?? fetched.title ?? 'Loading…',
    artist: track.artist ?? fetched.artist ?? '',
    durationMs: track.durationMs ?? fetched.durationMs ?? 0,
    bpm: track.bpm ?? fetched.bpm ?? null,
    firstBeatSec: track.firstBeatSec ?? fetched.firstBeatSec ?? 0,
  };
}
