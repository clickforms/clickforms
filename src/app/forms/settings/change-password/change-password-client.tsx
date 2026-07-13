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
      <h1 className="settings-page-title">Account Settings</h1>

      <div className="card contact-details-card">
        <div className="contact-details-header">
          <h2 className="contact-details-title">Change Password</h2>
          <p className="contact-details-intro">
            Choose a strong password with at least 8 characters.
          </p>
        </div>

        <form className="settings-form" onSubmit={handleSubmit}>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <label className="settings-field">
            <span className="settings-label">Current password</span>
            <input
              className="text-input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </label>

          <label className="settings-field">
            <span className="settings-label">New password</span>
            <input
              className="text-input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </label>

          <label className="settings-field">
            <span className="settings-label">Confirm new password</span>
            <input
              className="text-input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </label>

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
