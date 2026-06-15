// A tiny app-wide toast channel. Any module — including non-React code like the
// player engine — can call `toast(...)` to surface a transient message without
// prop-drilling an error handler down the tree. The <Toaster> component
// subscribes and renders them. This is the project's "main error way": the
// catch-all for failures that have no better local UI to live in.

export type ToastLevel = 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  level: ToastLevel;
}

/** How long a toast stays before auto-dismissing. */
export const TOAST_TTL_MS = 5000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to changes (for useSyncExternalStore). Returns an unsubscribe fn. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current toasts. Stable reference until the list changes. */
export function getToasts(): Toast[] {
  return toasts;
}

export function dismissToast(id: number): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

/** Show a transient message. Defaults to an error-styled toast. */
export function toast(message: string, level: ToastLevel = 'error'): number {
  const id = nextId++;
  toasts = [...toasts, { id, message, level }];
  emit();
  setTimeout(() => dismissToast(id), TOAST_TTL_MS);
  return id;
}
