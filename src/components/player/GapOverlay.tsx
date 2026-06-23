/** Inter-track gap overlay: countdown with +5s / Hold / Start-now. */
export default function GapOverlay({
  gapRemaining,
  onExtend,
  onHold,
  onSkip,
}: {
  gapRemaining: number;
  onExtend: (seconds: number) => void;
  onHold: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <span className="muted">Next track in</span>
        <span className="gap-num">{gapRemaining}</span>
        <button className="add-time" onClick={() => onExtend(5)}>
          +5s
        </button>
        <div className="overlay-actions">
          <button className="ghost" onClick={onHold}>
            Hold
          </button>
          <button className="primary" onClick={onSkip}>
            Start now
          </button>
        </div>
      </div>
    </div>
  );
}
