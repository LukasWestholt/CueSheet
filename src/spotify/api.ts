// Thin wrapper over the Spotify Web API "Connect" endpoints. These control
// playback on whichever device is active (e.g. an Android tablet on Bluetooth)
// and report its position — the PWA itself never plays audio.
import { getAccessToken } from './auth';
import { cached } from './metaCache';

const BASE = 'https://api.spotify.com/v1';

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number | null;
}

export async function getDevices(): Promise<SpotifyDevice[]> {
  const res = await api('/me/player/devices');
  if (!res.ok) return [];
  const data = await res.json();
  return (data.devices ?? []) as SpotifyDevice[];
}

export async function transferPlayback(deviceId: string, play = false): Promise<void> {
  await api('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

function deviceQuery(deviceId?: string): string {
  return deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
}

export async function playTrack(
  uri: string,
  deviceId?: string,
  positionMs = 0,
): Promise<void> {
  const res = await api(`/me/player/play${deviceQuery(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
  });
  if (!res.ok && res.status !== 202) {
    throw new Error(`Play failed (${res.status}): ${await res.text()}`);
  }
}

export async function pause(deviceId?: string): Promise<void> {
  await api(`/me/player/pause${deviceQuery(deviceId)}`, { method: 'PUT' });
}

export async function resume(deviceId?: string): Promise<void> {
  await api(`/me/player/play${deviceQuery(deviceId)}`, { method: 'PUT' });
}

export async function seek(positionMs: number, deviceId?: string): Promise<void> {
  const params = new URLSearchParams({ position_ms: String(Math.round(positionMs)) });
  if (deviceId) params.set('device_id', deviceId);
  await api(`/me/player/seek?${params.toString()}`, { method: 'PUT' });
}

export interface PlaybackSnapshot {
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  trackUri: string | null;
  deviceId: string | null;
  deviceName: string | null;
  fetchedAt: number;
}

function trackIdFromUri(uri: string): string {
  return uri.split(':').pop() ?? uri;
}

/** A real Spotify track id is 22 base62 chars (filters out REPLACE_ME stubs). */
function isValidTrackId(id: string): boolean {
  return /^[A-Za-z0-9]{22}$/.test(id);
}

export interface TrackInfo {
  title: string;
  artist: string;
  durationMs: number;
  /** International Standard Recording Code — used to look up BPM elsewhere. */
  isrc: string | null;
}

function parseTrackInfo(t: {
  name?: string;
  artists?: { name: string }[];
  duration_ms?: number;
  external_ids?: { isrc?: string };
}): TrackInfo {
  return {
    title: t.name ?? '',
    artist: (t.artists ?? []).map((a) => a.name).join(', '),
    durationMs: t.duration_ms ?? 0,
    isrc: t.external_ids?.isrc ?? null,
  };
}

/**
 * Basic track metadata (title/artist/duration) — always available, immutable
 * per track, so cached by id (memory + localStorage). Only successful fetches
 * are cached; a failure returns null and is retried next time.
 */
export async function getTrackInfo(uri: string): Promise<TrackInfo | null> {
  const id = trackIdFromUri(uri);
  if (!isValidTrackId(id)) return null;
  return cached('trackInfo', id, async () => {
    const res = await api(`/tracks/${id}`);
    if (!res.ok) return null;
    return parseTrackInfo(await res.json());
  });
}

/**
 * Metadata for several tracks, keyed by URI. Uses parallel single-track
 * requests rather than the multi-get /tracks?ids endpoint, which Spotify
 * forbids (403) for many newer development-mode apps.
 */
export async function getTracksInfo(uris: string[]): Promise<Record<string, TrackInfo>> {
  const entries = await Promise.all(
    uris.map(async (uri) => [uri, await getTrackInfo(uri)] as const),
  );
  const out: Record<string, TrackInfo> = {};
  for (const [uri, info] of entries) {
    if (info) out[uri] = info;
  }
  return out;
}

export interface TrackSearchResult {
  uri: string;
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  isrc: string | null;
}

/** Searches the Spotify catalog for tracks matching a free-text query. */
export async function searchTracks(query: string, limit = 8): Promise<TrackSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await api(`/search?type=track&limit=${limit}&q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  const items = (data.tracks?.items ?? []) as {
    uri?: string;
    id?: string;
    name?: string;
    artists?: { name: string }[];
    duration_ms?: number;
    external_ids?: { isrc?: string };
  }[];
  return items
    .filter((t) => t.uri && t.id)
    .map((t) => ({
      uri: t.uri as string,
      id: t.id as string,
      title: t.name ?? '',
      artist: (t.artists ?? []).map((a) => a.name).join(', '),
      durationMs: t.duration_ms ?? 0,
      isrc: t.external_ids?.isrc ?? null,
    }));
}

export interface PlaylistTrack {
  uri: string;
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  isrc: string | null;
}

/** Extracts a playlist id from a URL, spotify: URI, or a raw 22-char id. */
export function playlistIdFromInput(input: string): string | null {
  const s = input.trim();
  const m = s.match(/playlist[:/]([A-Za-z0-9]{22})/);
  if (m) return m[1];
  return /^[A-Za-z0-9]{22}$/.test(s) ? s : null;
}

interface RawPlaylistItem {
  track?: {
    uri?: string;
    id?: string;
    type?: string;
    name?: string;
    artists?: { name: string }[];
    duration_ms?: number;
    external_ids?: { isrc?: string };
  } | null;
}

/** Fetches a playlist's tracks (paginated, capped at `max`). */
export async function getPlaylistTracks(input: string, max = 200): Promise<PlaylistTrack[]> {
  const id = playlistIdFromInput(input);
  if (!id) return [];
  const out: PlaylistTrack[] = [];
  let path: string | null =
    `/playlists/${id}/tracks?limit=100` +
    '&fields=items(track(uri,id,type,name,artists(name),duration_ms,external_ids(isrc))),next';
  while (path && out.length < max) {
    const res = await api(path);
    if (!res.ok) throw new Error(`Playlist load failed (${res.status})`);
    const data = await res.json();
    for (const item of (data.items ?? []) as RawPlaylistItem[]) {
      const t = item.track;
      if (!t || !t.uri || !t.id || t.type === 'episode') continue;
      out.push({
        uri: t.uri,
        id: t.id,
        title: t.name ?? '',
        artist: (t.artists ?? []).map((a) => a.name).join(', '),
        durationMs: t.duration_ms ?? 0,
        isrc: t.external_ids?.isrc ?? null,
      });
    }
    const next: string | undefined = data.next;
    path = next ? next.replace('https://api.spotify.com/v1', '') : null;
  }
  return out.slice(0, max);
}

/**
 * First-beat timestamp (seconds) from audio-analysis (first bar, else first
 * beat). Returns null on failure — this endpoint is deprecated for apps created
 * after Nov 2024 and may 403, so keep a manual `firstBeatSec` as fallback.
 */
export async function getFirstBeatSec(uri: string): Promise<number | null> {
  const id = trackIdFromUri(uri);
  if (!isValidTrackId(id)) return null;
  // Cached by id: only a successful numeric result is stored, so the usual 403
  // (deprecated endpoint) returns null and stays retriable / cheap.
  return cached('firstBeatSec', id, async () => {
    const res = await api(`/audio-analysis/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    const start = data.bars?.[0]?.start ?? data.beats?.[0]?.start;
    return typeof start === 'number' ? start : null;
  });
}

/**
 * Fetches a track's tempo (BPM) from Spotify's audio-features endpoint.
 * Returns null on failure — note this endpoint is deprecated for apps created
 * after Nov 2024 and may return 403, so always keep a manual `bpm` as fallback.
 */
export async function getTrackTempo(uri: string): Promise<number | null> {
  const id = trackIdFromUri(uri);
  if (!isValidTrackId(id)) return null;
  // Cached by id: only a successful tempo is stored, so the usual 403
  // (deprecated endpoint) returns null and stays retriable / cheap.
  return cached('trackTempo', id, async () => {
    const res = await api(`/audio-features/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.tempo === 'number' && data.tempo > 0 ? data.tempo : null;
  });
}

/** Returns the current playback snapshot, or null when no device is active. */
export async function getPlaybackState(): Promise<PlaybackSnapshot | null> {
  const res = await api('/me/player');
  if (res.status === 204) return null; // no active device
  if (!res.ok) return null;
  const data = await res.json();
  return {
    isPlaying: Boolean(data.is_playing),
    progressMs: data.progress_ms ?? 0,
    durationMs: data.item?.duration_ms ?? 0,
    trackUri: data.item?.uri ?? null,
    deviceId: data.device?.id ?? null,
    deviceName: data.device?.name ?? null,
    fetchedAt: Date.now(),
  };
}
