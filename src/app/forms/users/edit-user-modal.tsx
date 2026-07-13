'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { RolePicker } from '@/app/forms/users/role-picker';
import type { UserRow } from '@/app/forms/users/users-client';
import type { InvitableRole } from '@/lib/user-roles';
import { INVITABLE_ROLES } from '@/lib/user-roles';

interface EditUserModalProps {
  user: UserRow | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function toInvitableRole(role: UserRow['role']): InvitableRole {
  return INVITABLE_ROLES.includes(role as InvitableRole) ? (role as InvitableRole) : 'member';
}

export function EditUserModal({ user, isSelf, onClose, onSaved }: EditUserModalProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<InvitableRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setRole(toInvitableRole(user.role));
    setError(null);
  }, [user]);

  if (!user) return null;
  // Captured as a plain string (not `user` itself) so handleSubmit's closure below
  // doesn't need a non-null assertion — TS can't carry the `!user` guard's narrowing
  // into a nested function, but a const primitive assigned right after the guard is fine.
  const userId = user.id;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), role: isSelf ? undefined : role }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not update this user.');
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-card users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="edit-user-title">
            Edit user
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
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
            <span className="settings-label">Email</span>
            <input className="text-input" type="email" value={user.email} disabled />
          </label>

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

          {isSelf ? (
            <p className="field-card-help">
              You cannot change your own role. Ask another organisation admin if you need a
              different role.
            </p>
          ) : (
            <RolePicker
              name={`edit-role-${user.id}`}
              value={role}
              onChange={setRole}
              disabled={isSubmitting}
            />
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="button button--ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
