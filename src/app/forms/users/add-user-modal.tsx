'use client';

import { type FormEvent, useState } from 'react';
import { RolePicker } from '@/app/forms/users/role-picker';
import type { InvitableRole } from '@/lib/user-roles';

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onInvited: (result: { inviteUrl: string; email: string }) => void;
}

export function AddUserModal({ open, onClose, onInvited }: AddUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  function reset() {
    setName('');
    setEmail('');
    setRole('member');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role }),
      });
      const data: { error?: string; inviteUrl?: string } = await res.json();
      if (!res.ok || !data.inviteUrl) {
        setError(data.error ?? 'Could not create the invite.');
        return;
      }

      onInvited({ inviteUrl: data.inviteUrl, email: email.trim() });
      reset();
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
    <div className="modal-overlay" onMouseDown={handleClose}>
      <div
        className="modal-card users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="add-user-title">
            Add user
          </h2>
          <button type="button" className="modal-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <label className="settings-field">
            <span className="settings-label">Name</span>
            <input
              className="text-input"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="settings-field">
            <span className="settings-label">Email</span>
            <input
              className="text-input"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <RolePicker name="invite-role" value={role} onChange={setRole} disabled={isSubmitting} />

          <div className="modal-footer">
            <button
              type="button"
              className="button button--ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Close
            </button>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating invite…' : 'Add user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
