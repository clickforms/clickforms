'use client';

import type { PlatformAdminRole } from '@prisma/client';
import { type FormEvent, useState } from 'react';
import { PLATFORM_ADMIN_ROLE_LABELS, PLATFORM_ADMIN_ROLES } from '@/lib/admin/platform-admin-roles';

interface InviteTeamMemberModalProps {
  open: boolean;
  onClose: () => void;
  onInvited: (result: {
    inviteId: string;
    inviteUrl: string;
    email: string;
    name: string;
    role: PlatformAdminRole;
    expiresAt: string;
  }) => void;
}

export function InviteTeamMemberModal({ open, onClose, onInvited }: InviteTeamMemberModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformAdminRole>('super_admin');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  function reset() {
    setName('');
    setEmail('');
    setRole('super_admin');
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
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role }),
      });
      const data: { error?: string; inviteId?: string; inviteUrl?: string; expiresAt?: string } =
        await res.json();
      if (!res.ok || !data.inviteUrl || !data.inviteId || !data.expiresAt) {
        setError(data.error ?? 'Could not create the invite.');
        return;
      }

      onInvited({
        inviteId: data.inviteId,
        inviteUrl: data.inviteUrl,
        email: email.trim(),
        name: name.trim(),
        role,
        expiresAt: data.expiresAt,
      });
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
        aria-labelledby="invite-team-member-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="invite-team-member-title">
            Invite a platform admin
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

          <label className="settings-field">
            <span className="settings-label">Permission level</span>
            <select
              className="text-input"
              value={role}
              onChange={(event) => setRole(event.target.value as PlatformAdminRole)}
              disabled={isSubmitting}
            >
              {PLATFORM_ADMIN_ROLES.map((value) => (
                <option key={value} value={value}>
                  {PLATFORM_ADMIN_ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

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
              {isSubmitting ? 'Creating invite…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
