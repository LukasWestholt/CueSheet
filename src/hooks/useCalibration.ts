import { useCallback, useEffect, useState } from 'react';
import {
  clearCalibration,
  loadCalibration,
  saveCalibration,
  type Calibration,
} from '../data/calibration';

/** Reads/writes the saved tap calibration for a track URI. */
export function useCalibration(uri: string) {
  const [cal, setCal] = useState<Calibration | null>(() => loadCalibration(uri));

  useEffect(() => {
    setCal(loadCalibration(uri));
  }, [uri]);

  const update = useCallback(
    (patch: Calibration) => {
      setCal((prev) => {
        const next = { ...(prev ?? {}), ...patch };
        saveCalibration(uri, next);
        return next;
      });
    },
    [uri],
  );

  const clear = useCallback(() => {
    clearCalibration(uri);
    setCal(null);
  }, [uri]);

  return { cal, update, clear };
}
