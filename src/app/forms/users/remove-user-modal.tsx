'use client';

import { useEffect } from 'react';
import type { UserRow } from '@/app/forms/users/users-client';

interface RemoveUserModalProps {
  user: UserRow | null;
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveUserModal({ user, isRemoving, onClose, onConfirm }: RemoveUserModalProps) {
  useEffect(() => {
    if (!user) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isRemoving) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, isRemoving, onClose]);

  if (!user) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape key and a Close/Cancel button are also wired up
    <div className="modal-overlay" onMouseDown={() => !isRemoving && onClose()}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-user-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="remove-user-title">
            Remove user
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isRemoving}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <p>
            Remove <strong>{user.name ?? user.email}</strong> from your organisation? They will lose
            access immediately.
          </p>
          {user.formsOwned > 0 ? (
            <p className="form-error">
              This user owns {user.formsOwned} form{user.formsOwned === 1 ? '' : 's'}. Transfer or
              delete those forms before removing them.
            </p>
          ) : null}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            disabled={isRemoving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={onConfirm}
            disabled={isRemoving || user.formsOwned > 0}
          >
            {isRemoving ? 'Removing…' : 'Remove user'}
          </button>
        </div>
      </div>
    </div>
  );
}
