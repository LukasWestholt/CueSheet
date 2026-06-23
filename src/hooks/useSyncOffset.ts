import { useEffect, useState } from 'react';
import { readString, writeString } from '../data/storage';

const OFFSET_KEY = 'tjf.syncOffsetMs';

/**
 * The Bluetooth sync-offset (ms), persisted. Compensates for speaker latency by
 * shifting the position used for calling resolution. Lives in PlayerScreen since
 * the whole screen needs it, but its persistence is self-contained here.
 */
export function useSyncOffset() {
  const [offsetMs, setOffsetMs] = useState<number>(() => Number(readString(OFFSET_KEY, '0')) || 0);
  useEffect(() => {
    writeString(OFFSET_KEY, String(offsetMs));
  }, [offsetMs]);
  return [offsetMs, setOffsetMs] as const;
}
