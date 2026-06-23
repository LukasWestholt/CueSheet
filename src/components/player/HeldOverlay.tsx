import { Play } from '../icons';
import { deviceOfflineMessage } from './messages';

/** "Paused between tracks" overlay, with keep-awake / device-asleep status. */
export default function HeldOverlay({
  keepAwake,
  deviceName,
  deviceAsleep,
  onContinue,
  onRecheck,
  onBack,
}: {
  keepAwake: boolean;
  deviceName: string | null;
  deviceAsleep: boolean;
  onContinue: () => void;
  onRecheck: () => void;
  onBack: () => void;
}) {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <span className="muted">Paused between tracks</span>
        <button className="primary big" onClick={onContinue}>
          Continue <Play size={18} />
        </button>
        {keepAwake &&
          deviceName &&
          (deviceAsleep ? (
            <div className="keepawake-offline">
              <span className="hint">{deviceOfflineMessage(deviceName)}</span>
              <button className="link" onClick={onRecheck}>
                Check again
              </button>
            </div>
          ) : (
            <span className="hint">Keeping {deviceName} awake</span>
          ))}
        <button className="link" onClick={onBack}>
          End session · back to list
        </button>
      </div>
    </div>
  );
}
