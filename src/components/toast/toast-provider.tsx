'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { ToastViewport } from '@/components/toast/toast-viewport';
import {
  MAX_VISIBLE_TOASTS,
  TOAST_DURATIONS,
  TOAST_EXIT_MS,
  type ToastContextValue,
  type ToastItem,
  type ToastOptions,
  type ToastVariant,
} from '@/components/toast/types';

type ToastAction =
  | { type: 'add'; toast: ToastItem }
  | { type: 'dismiss'; id: string }
  | { type: 'remove'; id: string };

function toastReducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.type) {
    case 'add':
      return [action.toast, ...state].slice(0, MAX_VISIBLE_TOASTS);
    case 'dismiss':
      return state.map((toast) =>
        toast.id === action.id ? { ...toast, dismissing: true } : toast,
      );
    case 'remove':
      return state.filter((toast) => toast.id !== action.id);
    default:
      return state;
  }
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearTimer = useCallback((key: string) => {
    const timer = timersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(key);
    }
  }, []);

  const removeToast = useCallback(
    (id: string) => {
      clearTimer(id);
      clearTimer(`remove-${id}`);
      dispatch({ type: 'remove', id });
    },
    [clearTimer],
  );

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      dispatch({ type: 'dismiss', id });

      const removeTimer = setTimeout(() => removeToast(id), TOAST_EXIT_MS);
      timersRef.current.set(`remove-${id}`, removeTimer);
    },
    [clearTimer, removeToast],
  );

  const showToast = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      const trimmed = message.trim();
      if (!trimmed) return '';

      const id = crypto.randomUUID();
      const durationMs = options?.durationMs ?? TOAST_DURATIONS[variant];

      dispatch({
        type: 'add',
        toast: { id, variant, message: trimmed, durationMs },
      });

      if (durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), durationMs);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message, options) => showToast('success', message, options),
      error: (message, options) => showToast('error', message, options),
      dismiss,
    }),
    [dismiss, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
