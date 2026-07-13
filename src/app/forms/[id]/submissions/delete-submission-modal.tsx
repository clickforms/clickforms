'use client';

import { useEffect } from 'react';

interface DeleteSubmissionModalProps {
  open: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

// Mirrors delete-form-modal.tsx's structure (backdrop, Escape-to-dismiss, danger button)
// but for a single response rather than a whole form — no responseCount warning needed.
export function DeleteSubmissionModal({
  open,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteSubmissionModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isDeleting, onClose]);

  if (!open) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape key and a Close/Cancel button are also wired up
    <div className="modal-overlay" onMouseDown={() => !isDeleting && onClose()}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-submission-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="delete-submission-modal-title">
            Delete response
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isDeleting}
          >
            ×
          </button>
        </div>

        <p className="modal-body-text">
          This response and any files attached to it will be permanently deleted. This cannot be
          undone.
        </p>

        <div className="modal-footer">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete response'}
          </button>
        </div>
      </div>
    </div>
  );
}
