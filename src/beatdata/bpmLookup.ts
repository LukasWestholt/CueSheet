import { getBpmByIsrc } from './deezer';
import { getBpmByTitleArtist } from './getsongbpm';

/**
 * Best-effort BPM lookup, shared by the player meta chain and the authoring
 * paths (editor search/recommendation, playlist seeding): Deezer first
 * (keyless, by ISRC), then GetSongBPM (by title/artist, needs a saved key) for
 * the many tracks Deezer reports as bpm:0. Never throws — null = no data.
 */
export async function lookupBpm(info: {
  isrc?: string | null;
  title: string;
  artist: string;
}): Promise<number | null> {
  const byIsrc = info.isrc ? await getBpmByIsrc(info.isrc).catch(() => null) : null;
  if (byIsrc != null) return byIsrc;
  return getBpmByTitleArtist(info.title, info.artist).catch(() => null);
}
