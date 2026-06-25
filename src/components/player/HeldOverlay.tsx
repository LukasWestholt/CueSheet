import { Play } from '../icons';
import { deviceOfflineMessage } from './messages';

/** "Paused between tracks" overlay, with keep-awake / device-asleep status. */
export default function HeldOverlay({
  keepAwake,
  silent,
  deviceName,
  deviceAsleep,
  onContinue,
  onRecheck,
  onStopSilent,
  onBack,
}: {
  keepAwake: boolean;
  /** True when keep-awake is holding the device by playing a silent track. */
  silent: boolean;
  deviceName: string | null;
  deviceAsleep: boolean;
  onContinue: () => void;
  onRecheck: () => void;
  /** Switch keep-awake off the silent track (back to the no-audio ping). */
  onStopSilent: () => void;
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
          ) : silent ? (
            <div className="keepawake-silent">
              <span className="hint">
                Playing a silent track on {deviceName} to keep it ready — Spotify shows it
                as “now playing”.
              </span>
              <button className="link" onClick={onStopSilent}>
                Stop the silent track
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
