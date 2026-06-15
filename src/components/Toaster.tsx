import { useSyncExternalStore } from 'react';
import { dismissToast, getToasts, subscribe } from '../data/toast';

/** Renders the app-wide toast queue (see src/data/toast.ts). Tap to dismiss. */
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getToasts, getToasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast toast-${t.level}`}
          onClick={() => dismissToast(t.id)}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
