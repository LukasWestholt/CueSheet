import { Volume } from '../icons';

/**
 * Speaker volume on the Connect device (no need to walk to the tablet). Disabled
 * until a reading is known; the engine debounces the write while dragging.
 */
export default function VolumeSlider({
  volumePercent,
  onChange,
}: {
  volumePercent: number | null;
  onChange: (percent: number) => void;
}) {
  return (
    <div className="volume-row">
      <Volume size={18} />
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label="Speaker volume"
        value={volumePercent ?? 0}
        disabled={volumePercent == null}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="muted volume-pct">
        {volumePercent == null ? '—' : `${volumePercent}%`}
      </span>
    </div>
  );
}
