import type { Track } from '../data/tracks';
import type { TrackInfo } from '../spotify/api';

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackList({
  tracks,
  infos,
  onSelect,
  onEdit,
}: {
  tracks: Track[];
  infos: Record<string, TrackInfo>;
  onSelect: (index: number) => void;
  onEdit?: (index: number) => void;
}) {
  return (
    <ul className="track-list">
      {tracks.map((t, i) => {
        const info = infos[t.spotifyUri];
        const title = t.title ?? info?.title ?? 'Unknown track';
        const artist = t.artist ?? info?.artist ?? '';
        const durationMs = t.durationMs ?? info?.durationMs;
        return (
          <li key={t.id} className="track-li">
            <button className="track-row" onClick={() => onSelect(i)}>
              <span className="track-index">{i + 1}</span>
              <span className="track-meta">
                <span className="track-title">{title}</span>
                <span className="track-artist">{artist}</span>
              </span>
              <span className="track-aside">
                <span className="badge">{t.steps.length} steps</span>
                {durationMs != null && (
                  <span className="track-time">{formatDuration(durationMs)}</span>
                )}
              </span>
            </button>
            {onEdit && (
              <button className="track-edit" onClick={() => onEdit(i)}>
                Edit
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
