// Thin wrapper over the Spotify Web API "Connect" endpoints. These control
// playback on whichever device is active (e.g. an Android tablet on Bluetooth)
// and report its position — the PWA itself never plays audio.
import { getAccessToken } from './auth';

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
}

function parseTrackInfo(t: { name?: string; artists?: { name: string }[]; duration_ms?: number }): TrackInfo {
  return {
    title: t.name ?? '',
    artist: (t.artists ?? []).map((a) => a.name).join(', '),
    durationMs: t.duration_ms ?? 0,
  };
}

/** Basic track metadata (title/artist/duration) — always available. */
export async function getTrackInfo(uri: string): Promise<TrackInfo | null> {
  const id = trackIdFromUri(uri);
  if (!isValidTrackId(id)) return null;
  const res = await api(`/tracks/${id}`);
  if (!res.ok) return null;
  return parseTrackInfo(await res.json());
}

/** Batch metadata lookup (up to 50 ids), keyed by the input URI. */
export async function getTracksInfo(uris: string[]): Promise<Record<string, TrackInfo>> {
  const out: Record<string, TrackInfo> = {};
  const valid = uris.filter((u) => isValidTrackId(trackIdFromUri(u)));
  if (valid.length === 0) return out;
  const res = await api(`/tracks?ids=${valid.map(trackIdFromUri).join(',')}`);
  if (!res.ok) return out;
  const data = await res.json();
  (data.tracks ?? []).forEach((t: unknown, i: number) => {
    if (t) out[valid[i]] = parseTrackInfo(t as Parameters<typeof parseTrackInfo>[0]);
  });
  return out;
}

/**
 * First-beat timestamp (seconds) from audio-analysis (first bar, else first
 * beat). Returns null on failure — this endpoint is deprecated for apps created
 * after Nov 2024 and may 403, so keep a manual `firstBeatSec` as fallback.
 */
export async function getFirstBeatSec(uri: string): Promise<number | null> {
  const id = trackIdFromUri(uri);
  if (!isValidTrackId(id)) return null;
  const res = await api(`/audio-analysis/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  const start = data.bars?.[0]?.start ?? data.beats?.[0]?.start;
  return typeof start === 'number' ? start : null;
}

/**
 * Fetches a track's tempo (BPM) from Spotify's audio-features endpoint.
 * Returns null on failure — note this endpoint is deprecated for apps created
 * after Nov 2024 and may return 403, so always keep a manual `bpm` as fallback.
 */
export async function getTrackTempo(uri: string): Promise<number | null> {
  const res = await api(`/audio-features/${trackIdFromUri(uri)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.tempo === 'number' && data.tempo > 0 ? data.tempo : null;
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
