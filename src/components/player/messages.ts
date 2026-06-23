/** Shared "the playback device went to sleep" copy (held overlay + lost banner). */
export function deviceOfflineMessage(name: string | null): string {
  return `${name ?? 'The playback device'} is offline — wake it up (open Spotify on it). It reconnects automatically once it’s back.`;
}
