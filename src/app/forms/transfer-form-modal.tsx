'use client';

import { useEffect, useState } from 'react';

export interface TransferFormModalMember {
  id: string;
  name: string;
}

interface TransferFormModalProps {
  open: boolean;
  formName: string;
  /** Org members excluding the form's current creator. */
  members: TransferFormModalMember[];
  isTransferring: boolean;
  onClose: () => void;
  onConfirm: (newOwnerId: string) => void;
}

export function TransferFormModal({
  open,
  formName,
  members,
  isTransferring,
  onClose,
  onConfirm,
}: TransferFormModalProps) {
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedId(members[0]?.id ?? '');
    }
  }, [open, members]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isTransferring) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isTransferring, onClose]);

  if (!open) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape key and a Close/Cancel button are also wired up
    <div className="modal-overlay" onMouseDown={() => !isTransferring && onClose()}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-form-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="transfer-form-modal-title">
            Transfer ownership
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isTransferring}
          >
            ×
          </button>
        </div>

        <p className="modal-body-text">
          Move <strong>{formName}</strong> to a new owner. They&rsquo;ll become the form&rsquo;s
          creator.
        </p>

        {members.length === 0 ? (
          <p className="modal-body-text modal-body-text--warning">
            There&rsquo;s no one else in this organisation to transfer to.
          </p>
        ) : (
          <select
            className="text-input"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            aria-label="New owner"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        )}

        <div className="modal-footer">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={isTransferring}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button"
            onClick={() => selectedId && onConfirm(selectedId)}
            disabled={isTransferring || !selectedId}
          >
            {isTransferring ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
