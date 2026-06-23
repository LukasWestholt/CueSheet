import { deviceOfflineMessage } from './messages';

/**
 * The two reconnect banners: the target Connect device disappeared (`noDevice`)
 * or another app hijacked playback (`hijacked`). noDevice takes precedence.
 */
export default function DeviceBanners({
  noDevice,
  hijacked,
  deviceName,
  onBack,
  onRecover,
}: {
  noDevice: boolean;
  hijacked: boolean;
  deviceName: string | null;
  onBack: () => void;
  onRecover: () => void;
}) {
  if (noDevice) {
    return (
      <div className="device-lost">
        <span>{deviceOfflineMessage(deviceName)}</span>
        <div className="device-lost-actions">
          <button className="ghost" onClick={onBack}>
            Devices
          </button>
          <button className="primary" onClick={onRecover}>
            Reconnect
          </button>
        </div>
      </div>
    );
  }
  if (hijacked) {
    return (
      <div className="device-lost">
        <span>
          Another app took over playback — a different track is playing. Take back control of
          this device:
        </span>
        <div className="device-lost-actions">
          <button className="primary" onClick={onRecover}>
            Take back control
          </button>
        </div>
      </div>
    );
  }
  return null;
}
