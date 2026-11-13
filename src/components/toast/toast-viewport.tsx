'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ToastItem } from '@/components/toast/types';
import './toast-action.css';
import './toast.css';

function SuccessIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 9.25 7.75 11.5 12.5 6.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 5.75v4.25M9 12.25h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  // Rendered into <body> (after mount) so no ancestor's transform/animation can pull the
  // fixed-position stack away from the top-right corner of the window.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => {
        const isError = toast.variant === 'error';
        return (
          <div
            key={toast.id}
            className={`toast toast--${toast.variant}${toast.dismissing ? ' toast--dismissing' : ''}`}
            role={isError ? 'alert' : 'status'}
            aria-atomic="true"
            style={
              toast.durationMs > 0
                ? ({ '--toast-duration': `${toast.durationMs}ms` } as React.CSSProperties)
                : undefined
            }
          >
            <span className="toast-icon" aria-hidden="true">
              {isError ? <ErrorIcon /> : <SuccessIcon />}
            </span>
            <p className="toast-message">
              {toast.message}
              {toast.action ? (
                <>
                  {' '}
                  <a className="toast-action" href={toast.action.href}>
                    {toast.action.label}
                  </a>
                </>
              ) : null}
            </p>
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(toast.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
