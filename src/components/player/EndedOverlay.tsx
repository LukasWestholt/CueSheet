import { Play } from '../icons';
import { formatLong } from '../../data/time';

/**
 * Shown when the routine has run out (phase `ended`) — closes the class
 * cleanly instead of leaving a frozen last frame. In a setlist session it
 * summarises the whole session; for a single track it offers a replay.
 */
export default function EndedOverlay({
  session,
  onReplay,
  onRestartSession,
  onBack,
}: {
  /** Present when this was a setlist session. */
  session: { count: number; totalMs: number } | null;
  /** Replay the just-finished track. */
  onReplay: () => void;
  /** Restart the session from its first track (session mode only). */
  onRestartSession: () => void;
  onBack: () => void;
}) {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <span className="muted">{session ? 'Session complete' : 'Track finished'}</span>
        {session && (
          <span className="ended-summary">
            {session.count} {session.count === 1 ? 'track' : 'tracks'} ·{' '}
            {formatLong(session.totalMs)}
          </span>
        )}
        <button className="primary big" onClick={onBack}>
          Back to list
        </button>
        {session ? (
          <button className="link" onClick={onRestartSession}>
            Restart session <Play size={16} />
          </button>
        ) : null}
        <button className="link" onClick={onReplay}>
          Replay {session ? 'last track' : 'track'} <Play size={16} />
        </button>
      </div>
    </div>
  );
}
