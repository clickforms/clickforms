'use client';

import { type FormEvent, useState } from 'react';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';

export function ChangePasswordClient() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      if (!res.ok) {
        setError(await readApiError(res, 'Could not change your password'));
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <p className="settings-page-kicker">Personal profile</p>
        <h1 className="settings-page-title">Account settings</h1>
        <p className="settings-page-lead">
          Keep your account secure with a strong, unique password.
        </p>
      </header>

      <div className="card contact-details-card">
        <div className="contact-details-header">
          <span className="contact-details-header-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <title>Password</title>
              <rect
                x="5"
                y="9"
                width="10"
                height="7.5"
                rx="1.3"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M7 9V6.8a3 3 0 0 1 6 0V9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div>
            <h2 className="contact-details-title">Change password</h2>
            <p className="contact-details-intro">
              Choose a strong password with at least 8 characters.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error ? (
            <p className="form-error contact-details-error" role="alert">
              {error}
            </p>
          ) : null}

          <dl className="contact-details-list contact-details-list--table contact-details-list--wide-inputs">
            <div className="contact-details-row">
              <dt>Current password</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>New password</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>Confirm new password</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </dd>
            </div>
          </dl>

          <div className="contact-details-actions">
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
