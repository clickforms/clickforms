'use client';

import { useEffect, useState } from 'react';
import type { UserRow } from '@/app/forms/users/users-client';

interface RemoveUserModalProps {
  user: UserRow | null;
  /** Other org members this user's forms could be transferred to. */
  otherUsers: UserRow[];
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: (transferFormsTo?: string) => void;
}

export function RemoveUserModal({
  user,
  otherUsers,
  isRemoving,
  onClose,
  onConfirm,
}: RemoveUserModalProps) {
  const [transferTo, setTransferTo] = useState('');

  useEffect(() => {
    setTransferTo(otherUsers[0]?.id ?? '');
  }, [otherUsers]);

  useEffect(() => {
    if (!user) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isRemoving) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, isRemoving, onClose]);

  if (!user) return null;

  const needsTransfer = user.formsOwned > 0;
  const canConfirm = !needsTransfer || Boolean(transferTo);

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
          {needsTransfer ? (
            <>
              <p className="form-error">
                This user owns {user.formsOwned} form{user.formsOwned === 1 ? '' : 's'}. Choose who
                should receive them.
              </p>
              {otherUsers.length === 0 ? (
                <p className="form-error">
                  There&rsquo;s no one else in this organisation to transfer their forms to.
                </p>
              ) : (
                <select
                  className="text-input"
                  value={transferTo}
                  onChange={(event) => setTransferTo(event.target.value)}
                  aria-label="Transfer forms to"
                >
                  {otherUsers.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name ?? candidate.email}
                    </option>
                  ))}
                </select>
              )}
            </>
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
            onClick={() => onConfirm(needsTransfer ? transferTo : undefined)}
            disabled={isRemoving || !canConfirm}
          >
            {isRemoving ? 'Removing…' : needsTransfer ? 'Remove and transfer forms' : 'Remove user'}
          </button>
        </div>
      </div>
    </div>
  );
}
