import { useCallback, useEffect, useState } from 'react';
import { getDevices, transferPlayback, type SpotifyDevice } from '../spotify/api';

export default function DevicePicker({
  selectedDeviceId,
  onSelect,
}: {
  selectedDeviceId: string | null;
  onSelect: (id: string) => void;
}) {
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await getDevices();
    setDevices(list);
    // Default to whichever device Spotify already considers active.
    if (!selectedDeviceId) {
      const active = list.find((d) => d.is_active) ?? list[0];
      if (active) onSelect(active.id);
    }
    setLoading(false);
  }, [selectedDeviceId, onSelect]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const choose = async (d: SpotifyDevice) => {
    onSelect(d.id);
    await transferPlayback(d.id, false);
    refresh();
  };

  return (
    <section className="device-picker">
      <div className="device-head">
        <span className="muted">Playback device</span>
        <button className="link" onClick={refresh} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>
      {devices.length === 0 ? (
        <p className="hint">
          No devices found. Open the Spotify app on your tablet, start playing
          anything once, then tap Refresh.
        </p>
      ) : (
        <div className="device-chips">
          {devices.map((d) => (
            <button
              key={d.id}
              className={`chip ${d.id === selectedDeviceId ? 'chip-active' : ''}`}
              onClick={() => choose(d)}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
