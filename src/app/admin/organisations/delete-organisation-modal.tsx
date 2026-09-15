'use client';

import { useEffect, useState } from 'react';

interface DeleteOrganisationModalProps {
  open: boolean;
  organizationName: string;
  userCount: number;
  formCount: number;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Deleting an organisation cascades to every table scoped to it — users, forms,
 * submissions, files, everything (see prisma/schema.prisma `onDelete: Cascade`) — so
 * this asks the admin to type the organisation's name before the Delete button becomes
 * clickable, rather than a single confirm click like DeleteFormModal. Much higher blast
 * radius than deleting one form.
 */
export function DeleteOrganisationModal({
  open,
  organizationName,
  userCount,
  formCount,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteOrganisationModalProps) {
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!open) return;
    setConfirmText('');
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isDeleting, onClose]);

  if (!open) return null;

  const canDelete = confirmText.trim() === organizationName && !isDeleting;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape key and a Close/Cancel button are also wired up
    <div className="modal-overlay" onMouseDown={() => !isDeleting && onClose()}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-organisation-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="delete-organisation-modal-title">
            Delete organisation
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
          <strong>{organizationName}</strong> and everything in it will be permanently deleted. This
          cannot be undone.
        </p>
        <p className="modal-body-text modal-body-text--warning">
          {userCount} user{userCount === 1 ? '' : 's'} and {formCount} form
          {formCount === 1 ? '' : 's'} (with all their responses and files) will be deleted too.
        </p>

        <label className="settings-field">
          <span className="settings-label">
            Type <strong>{organizationName}</strong> to confirm
          </span>
          <input
            className="text-input"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            disabled={isDeleting}
            // biome-ignore lint/a11y/noAutofocus: the confirmation input is the only remaining action in this dialog
            autoFocus
          />
        </label>

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
            disabled={!canDelete}
          >
            {isDeleting ? 'Deleting…' : 'Delete organisation'}
          </button>
        </div>
      </div>
    </div>
  );
}
