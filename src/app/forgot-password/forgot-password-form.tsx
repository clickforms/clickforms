'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data: { error?: string; devResetUrl?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      // Dev-mode convenience — see the devResetUrl comment in the API route. Never
      // present once SMTP is configured, so this is a no-op in production.
      if (data.devResetUrl) {
        console.log('[dev] password reset link:', data.devResetUrl);
      }

      setSubmittedEmail(email.trim());
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submittedEmail) {
    return (
      <div className="login-form">
        <div className="signup-check-email">
          <div className="signup-check-email-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="6" width="22" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M4 8.5l10 7 10-7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="signup-check-email-title">Check your email</h3>
          <p>
            If an account exists for <strong>{submittedEmail}</strong>, we&apos;ve sent a link to
            reset your password. It expires in 1 hour.
          </p>
        </div>
        <p className="login-form-footer">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {error ? (
        <p className="login-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <label className="login-field">
        <span className="login-field-label">Email</span>
        <input
          className="text-input login-field-input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          placeholder="you@company.com.au"
        />
      </label>

      <button className="button login-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="login-form-footer">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
