import { Volume } from '../icons';

/**
 * Speaker volume on the Connect device (no need to walk to the tablet). Hidden
 * entirely until a reading is known — a null volume means the device can't
 * report (and usually can't accept) remote volume, so a dead slider would only
 * mislead; the engine debounces the write while dragging.
 */
export default function VolumeSlider({
  volumePercent,
  onChange,
}: {
  volumePercent: number | null;
  onChange: (percent: number) => void;
}) {
  if (volumePercent == null) return null;
  return (
    <div className="volume-row">
      <Volume size={18} />
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label="Speaker volume"
        value={volumePercent}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="muted volume-pct">{volumePercent}%</span>
    </div>
  );
}
