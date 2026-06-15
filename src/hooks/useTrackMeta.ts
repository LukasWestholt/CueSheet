import { useEffect, useMemo, useState } from 'react';
import type { Track } from '../data/tracks';
import type { Calibration } from '../data/calibration';
import { resolveTrackMeta, type FetchedMeta, type ResolvedMeta } from '../data/meta';
import { getFirstBeatSec, getTrackInfo, getTrackTempo } from '../spotify/api';
import { getBpmByIsrc } from '../beatdata/deezer';

/**
 * Fetches the metadata a track doesn't author itself: title/artist/duration
 * (always available), plus best-effort BPM and first-beat (deprecated endpoints
 * — fall back to manual values). Authored values are never fetched. A saved tap
 * `calibration` overrides the fetched BPM/first-beat (but not authored values).
 */
export function useTrackMeta(track: Track, calibration?: Calibration | null): ResolvedMeta {
  const [fetched, setFetched] = useState<Partial<FetchedMeta>>({});

  useEffect(() => {
    let active = true;
    setFetched({});
    const merge = (patch: Partial<FetchedMeta>) =>
      active && setFetched((prev) => ({ ...prev, ...patch }));

    getTrackInfo(track.spotifyUri)
      .then((info) => {
        if (!info) return;
        merge({
          title: info.title,
          artist: info.artist,
          durationMs: info.durationMs,
          imageUrl: info.imageUrl,
        });
        // Best-effort BPM from Deezer (by ISRC) when not authored — Spotify's
        // own tempo endpoint is usually 403. Don't clobber a BPM already set
        // (Spotify tempo, if it ever returns, wins); calibration still overrides.
        if (track.bpm == null && info.isrc) {
          getBpmByIsrc(info.isrc)
            .then((bpm) => {
              if (bpm != null && active) {
                setFetched((prev) => (prev.bpm != null ? prev : { ...prev, bpm }));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    if (track.bpm == null) {
      getTrackTempo(track.spotifyUri).then((bpm) => merge({ bpm })).catch(() => {});
    }
    if (track.firstBeatSec == null) {
      getFirstBeatSec(track.spotifyUri).then((firstBeatSec) => merge({ firstBeatSec })).catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [track.spotifyUri, track.bpm, track.firstBeatSec]);

  return useMemo(() => {
    // Calibration sits between Spotify (fetched) and authored values.
    const merged: Partial<FetchedMeta> = { ...fetched };
    if (calibration?.bpm != null) merged.bpm = calibration.bpm;
    if (calibration?.firstBeatSec != null) merged.firstBeatSec = calibration.firstBeatSec;
    return resolveTrackMeta(track, merged);
  }, [track, fetched, calibration]);
}
