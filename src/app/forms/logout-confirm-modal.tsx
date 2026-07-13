'use client';

import { useEffect } from 'react';

interface LogoutConfirmModalProps {
  open: boolean;
  isSigningOut: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmModal({
  open,
  isSigningOut,
  onClose,
  onConfirm,
}: LogoutConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSigningOut) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isSigningOut, onClose]);

  if (!open) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape key and a Cancel button are also wired up
    <div className="modal-overlay" onMouseDown={() => !isSigningOut && onClose()}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="logout-confirm-modal-title">
            Sign out
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isSigningOut}
          >
            ×
          </button>
        </div>

        <p className="modal-body-text">
          You&apos;ll need to sign in again to access the forms workspace.
        </p>

        <div className="modal-footer">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={isSigningOut}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={onConfirm}
            disabled={isSigningOut}
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}
