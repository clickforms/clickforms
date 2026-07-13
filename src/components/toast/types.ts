export type ToastVariant = 'success' | 'error';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  durationMs: number;
  dismissing?: boolean;
}

export interface ToastOptions {
  /** Defaults to 4s for success, 6s for error. Pass `0` to disable auto-dismiss. */
  durationMs?: number;
}

export interface ToastContextValue {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

export const TOAST_DURATIONS: Record<ToastVariant, number> = {
  success: 4_000,
  error: 6_000,
};

export const MAX_VISIBLE_TOASTS = 5;
export const TOAST_EXIT_MS = 200;
