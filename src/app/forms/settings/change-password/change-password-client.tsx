'use client';

import { type FormEvent, useState } from 'react';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';
import {
  isStrongPassword,
  PASSWORD_HINT,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '@/lib/users/password';

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.5 8s2.2-4.5 6.5-4.5S14.5 8 14.5 8s-2.2 4.5-6.5 4.5S1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.5 8s2.2-4.5 6.5-4.5S14.5 8 14.5 8s-2.2 4.5-6.5 4.5S1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// Wraps a password <input> with a show/hide toggle — each instance gets its own
// visibility state, so revealing "New password" doesn't also reveal "Confirm new
// password". Toggling swaps the input's type between "password" and "text" rather than
// unmasking via CSS, since that's what actually controls whether the browser/password
// manager treats it as a credential field.
function PasswordInput({
  value,
  onChange,
  autoComplete,
  minLength,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        className="text-input contact-details-input password-field-input"
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        disabled={disabled}
      />
      <button
        type="button"
        className="password-field-toggle"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

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
    if (!isStrongPassword(newPassword)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

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
        <h1 className="settings-page-title">Change password</h1>
        <p className="settings-page-lead">Update your password to keep your account secure.</p>
      </header>

      <div className="card contact-details-card">
        <div className="contact-details-header">
          <span
            className="contact-details-header-icon contact-details-header-icon--lavender"
            aria-hidden="true"
          >
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
              Choose a strong password you don&apos;t use anywhere else.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error ? (
            <p className="form-error contact-details-error" role="alert">
              {error}
            </p>
          ) : null}

          <dl className="contact-details-list">
            <div className="contact-details-row">
              <dt>Current password</dt>
              <dd>
                <PasswordInput
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>New password</dt>
              <dd>
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  disabled={isSubmitting}
                />
                <span className="login-field-hint">{PASSWORD_HINT}</span>
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>Confirm new password</dt>
              <dd>
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  disabled={isSubmitting}
                />
              </dd>
            </div>
          </dl>

          <div className="contact-details-actions">
            <p>You&apos;ll stay signed in on this device.</p>
            <button type="submit" className="button button--dark" disabled={isSubmitting}>
              {isSubmitting ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
