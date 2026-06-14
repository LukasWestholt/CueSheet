import { useEffect, useMemo, useState } from 'react';
import type { Track } from '../data/tracks';
import { resolveTrackMeta, type FetchedMeta, type ResolvedMeta } from '../data/meta';
import { getFirstBeatSec, getTrackInfo, getTrackTempo } from '../spotify/api';

/**
 * Fetches the metadata a track doesn't author itself: title/artist/duration
 * (always available), plus best-effort BPM and first-beat (deprecated endpoints
 * — fall back to manual values). Authored values are never fetched.
 */
export function useTrackMeta(track: Track): ResolvedMeta {
  const [fetched, setFetched] = useState<Partial<FetchedMeta>>({});

  useEffect(() => {
    let active = true;
    setFetched({});
    const merge = (patch: Partial<FetchedMeta>) =>
      active && setFetched((prev) => ({ ...prev, ...patch }));

    getTrackInfo(track.spotifyUri)
      .then((info) => {
        if (info) merge({ title: info.title, artist: info.artist, durationMs: info.durationMs });
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

  return useMemo(() => resolveTrackMeta(track, fetched), [track, fetched]);
}
