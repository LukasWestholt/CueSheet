import type { Track } from '../data/tracks';
import type { TrackInfo } from '../spotify/api';
import { cleanTitle } from '../data/title';
import { Star, Music, Check, Plus } from './icons';

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface TrackItem {
  track: Track;
  /** Index in the full tracks array (kept stable through filtering/sorting). */
  index: number;
}

export default function TrackList({
  items,
  infos,
  favorites,
  setlist,
  onSelect,
  onEdit,
  onToggleFavorite,
  onToggleSetlist,
}: {
  items: TrackItem[];
  infos: Record<string, TrackInfo>;
  favorites: Set<string>;
  /** Ids currently in the session setlist (for the queue toggle). */
  setlist?: Set<string>;
  onSelect: (index: number) => void;
  onEdit?: (index: number) => void;
  onToggleFavorite?: (id: string) => void;
  onToggleSetlist?: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="hint empty-list">No tracks match.</p>;
  }
  return (
    <ul className="track-list">
      {items.map(({ track: t, index: i }) => {
        const info = infos[t.spotifyUri];
        const title = t.title ?? info?.title ?? 'Unknown track';
        const artist = t.artist ?? info?.artist ?? '';
        const durationMs = t.durationMs ?? info?.durationMs;
        const fav = favorites.has(t.id);
        const queued = setlist?.has(t.id) ?? false;
        return (
          <li key={t.id} className="track-li">
            {(onToggleFavorite || onToggleSetlist) && (
              <div className="track-side">
                {onToggleFavorite && (
                  <button
                    className={`track-fav ${fav ? 'is-fav' : ''}`}
                    aria-label={fav ? 'Remove favorite' : 'Add favorite'}
                    aria-pressed={fav}
                    onClick={() => onToggleFavorite(t.id)}
                  >
                    <Star filled={fav} size={20} />
                  </button>
                )}
                {onToggleSetlist && (
                  <button
                    className={`track-queue ${queued ? 'is-queued' : ''}`}
                    aria-pressed={queued}
                    aria-label={queued ? 'Remove from setlist' : 'Add to setlist'}
                    title={queued ? 'In setlist' : 'Add to setlist'}
                    onClick={() => onToggleSetlist(t.id)}
                  >
                    {queued ? <Check size={20} /> : <Plus size={20} />}
                  </button>
                )}
              </div>
            )}
            <button className="track-row" onClick={() => onSelect(i)}>
              <span className="track-index">{i + 1}</span>
              {info?.imageUrl ? (
                <img className="track-art" src={info.imageUrl} alt="" loading="lazy" />
              ) : (
                <span className="track-art track-art-ph" aria-hidden="true">
                  <Music size={20} />
                </span>
              )}
              <span className="track-meta">
                <span className="track-title" title={title}>
                  {cleanTitle(title)}
                </span>
                <span className="track-artist">{artist}</span>
              </span>
              <span className="track-aside">
                {t.wip && <span className="badge badge-wip">WIP</span>}
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
