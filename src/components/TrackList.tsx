import type { Track } from '../data/tracks';

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackList({
  tracks,
  onSelect,
}: {
  tracks: Track[];
  onSelect: (index: number) => void;
}) {
  return (
    <ul className="track-list">
      {tracks.map((t, i) => (
        <li key={t.id}>
          <button className="track-row" onClick={() => onSelect(i)}>
            <span className="track-index">{i + 1}</span>
            <span className="track-meta">
              <span className="track-title">{t.title}</span>
              <span className="track-artist">{t.artist}</span>
            </span>
            <span className="track-aside">
              <span className="badge">{t.steps.length} steps</span>
              <span className="track-time">{formatDuration(t.durationMs)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
