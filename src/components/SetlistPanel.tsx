import type { Track } from '../data/tracks';
import type { TrackInfo } from '../spotify/api';
import { sessionEstimate } from '../data/setlist';
import { DEFAULT_GAP_SECONDS } from '../hooks/usePlayerEngine';
import { ArrowUp, ArrowDown, X, Play, Link as LinkIcon } from './icons';
import { formatClock } from '../data/time';
import { primarySignature } from '../data/signatureMoves';
import { categoryOf, CATEGORY_TITLES } from '../data/trackCategory';
import { sessionPath } from '../nav/routes';
import { useCopyFlag } from '../hooks/useCopyFlag';

function fmtMinutes(ms: number): string {
  return `${Math.max(0, Math.round(ms / 60000))} min`;
}

/**
 * The session queue: an ordered subset of routines to play through with the
 * normal inter-track gap. Shows a total-time estimate and launches the player.
 */
export default function SetlistPanel({
  tracks,
  infos,
  onMove,
  onRemove,
  onClear,
  onStart,
}: {
  /** Resolved, ordered setlist tracks. */
  tracks: Track[];
  infos: Record<string, TrackInfo>;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onStart: () => void;
}) {
  // Hooks must run unconditionally — the early return sits below them.
  const [linkCopied, copyText] = useCopyFlag();
  if (tracks.length === 0) return null;

  // Share the ordered setlist as a /session/a,b,c link (native sheet where the
  // Web Share API exists, clipboard otherwise) — any coach with the same
  // routine sources can open the whole class plan.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareSetlist = () => {
    const url =
      window.location.origin + sessionPath(tracks.map((t) => t.id), import.meta.env.BASE_URL);
    if (canShare) navigator.share({ title: 'CueSheet setlist', url }).catch(() => {});
    else copyText(url);
  };

  const durations = tracks.map((t) => t.durationMs ?? infos[t.spotifyUri]?.durationMs ?? 0);
  const { totalMs } = sessionEstimate(durations, 0, 0, DEFAULT_GAP_SECONDS);
  const anyUnknown = durations.some((d) => d <= 0);

  return (
    <section className="setlist">
      <div className="setlist-head">
        <span className="muted">Setlist · {tracks.length} tracks</span>
        <span className="muted">
          {anyUnknown ? '≥' : '~'}
          {fmtMinutes(totalMs)}
        </span>
      </div>
      <ol className="setlist-list">
        {tracks.map((t, i) => {
          const title = t.title ?? infos[t.spotifyUri]?.title ?? 'Unknown track';
          const dur = durations[i];
          // Each row shows the track's dominant signature move, so an
          // unbalanced session (three Scissors tracks in a row) is visible
          // at a glance while ordering.
          const sig = primarySignature(t.steps);
          // Colored left edge = the track's session category (same colors as
          // the list badges), so the warm-up → main → main 2 arc of the
          // session is scannable top to bottom.
          const cat = categoryOf(t);
          return (
            <li
              key={t.id}
              className={`setlist-row${cat ? ` cat-${cat}` : ''}`}
              title={cat ? CATEGORY_TITLES[cat] : undefined}
            >
              <span className="sl-pos">{i + 1}</span>
              <span className="sl-title">{title}</span>
              {sig && <span className="sl-sig">{sig}</span>}
              {dur > 0 && <span className="sl-dur">{formatClock(dur)}</span>}
              <span className="sl-ops">
                <button className="icon-btn" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp size={18} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => onMove(i, 1)}
                  disabled={i === tracks.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown size={18} />
                </button>
                <button className="icon-btn danger" onClick={() => onRemove(t.id)} aria-label="Remove from setlist">
                  <X size={18} />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="setlist-actions">
        <button className="link" onClick={onClear}>
          Clear
        </button>
        <button className="link" onClick={shareSetlist}>
          <LinkIcon size={16} /> {canShare ? 'Share' : linkCopied ? 'Copied!' : 'Copy link'}
        </button>
        <button className="primary" onClick={onStart}>
          Start session <Play size={16} />
        </button>
      </div>
    </section>
  );
}
