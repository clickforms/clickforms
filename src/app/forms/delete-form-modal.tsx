'use client';

import { useEffect } from 'react';

interface DeleteFormModalProps {
  open: boolean;
  formName: string;
  responseCount: number;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteFormModal({
  open,
  formName,
  responseCount,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteFormModalProps) {
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
        aria-labelledby="delete-form-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="delete-form-modal-title">
            Delete form
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
          <strong>{formName}</strong> will be permanently deleted. This cannot be undone.
        </p>
        {responseCount > 0 ? (
          <p className="modal-body-text modal-body-text--warning">
            {responseCount} response{responseCount === 1 ? '' : 's'} will also be deleted.
          </p>
        ) : null}

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
            {isDeleting ? 'Deleting…' : 'Delete form'}
          </button>
        </div>
      </div>
    </div>
  );
}
