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
