/** Bluetooth sync-offset slider. Dumb: value + onChange; state lives upstream. */
export default function SyncOffsetSlider({
  offsetMs,
  onChange,
}: {
  offsetMs: number;
  onChange: (ms: number) => void;
}) {
  return (
    <div className="sync-row">
      <div className="sync-head">
        <span>Sync offset</span>
        <span className="muted">
          {offsetMs > 0 ? '+' : ''}
          {offsetMs} ms
        </span>
      </div>
      <input
        type="range"
        min={-1500}
        max={1500}
        step={50}
        value={offsetMs}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="hint">
        Nudge if the called step is ahead of / behind what you hear on the speaker.
      </p>
    </div>
  );
}
