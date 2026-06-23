import type { Phase } from '../../hooks/usePlayerEngine';
import { SkipBack, SkipForward } from '../icons';

function playLabel(phase: Phase): string {
  if (phase === 'playing') return 'Pause';
  if (phase === 'paused') return 'Resume';
  if (phase === 'ended') return 'Replay';
  return 'Play';
}

/** Prev / play-pause / next transport row. */
export default function PlayerControls({
  phase,
  onPrev,
  onNext,
  onPlayPause,
}: {
  phase: Phase;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
}) {
  return (
    <div className="controls">
      <button className="round" onClick={onPrev} aria-label="Previous track">
        <SkipBack />
      </button>
      <button className="round primary xl" onClick={onPlayPause}>
        {playLabel(phase)}
      </button>
      <button className="round" onClick={onNext} aria-label="Next track">
        <SkipForward />
      </button>
    </div>
  );
}
