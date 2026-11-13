'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { type FormEvent, useEffect, useState } from 'react';
import { PasswordField } from '@/components/password-field';
import { isPasswordAcceptable, PasswordRequirements } from '@/components/password-requirements';
import './reset-password.css';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/auth/reset-password/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(data.error ?? 'This password reset link is invalid or has expired.');
        return;
      }
      setEmail(data.email as string);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;
    if (!isPasswordAcceptable(password) || password !== confirm) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Could not reset your password.');
        return;
      }

      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/forms',
      });

      if (signInResult?.error) {
        router.push('/login');
        return;
      }

      router.push('/forms');
      router.refresh();
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="login-form">
        <p className="login-form-error" role="alert">
          {loadError}
        </p>
        <p className="login-form-footer">
          <Link href="/forgot-password">Request a new link</Link>
        </p>
      </div>
    );
  }

  if (!email) {
    return <p className="login-form-footer">Loading…</p>;
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {submitError ? (
        <p className="login-form-error" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="reset-account">
        <span className="reset-account-avatar" aria-hidden="true">
          {email.charAt(0)}
        </span>
        <span className="reset-account-text">
          <span className="reset-account-label">Resetting password for</span>
          <span className="reset-account-email">{email}</span>
        </span>
      </div>

      <div className="login-field">
        <label className="login-field-label" htmlFor="reset-password-new-password">
          New password
        </label>
        <PasswordField
          id="reset-password-new-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={setPassword}
          disabled={isSubmitting}
          placeholder=""
          showHint={false}
        />
        <PasswordRequirements password={password} />
      </div>

      <div className="login-field">
        <label className="login-field-label" htmlFor="reset-password-confirm-password">
          Confirm new password
        </label>
        <PasswordField
          id="reset-password-confirm-password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={setConfirm}
          disabled={isSubmitting}
          placeholder=""
          showHint={false}
        />
        {confirm.length > 0 ? (
          <p
            className={`reset-match ${password === confirm ? 'reset-match--ok' : 'reset-match--bad'}`}
            aria-live="polite"
          >
            {password === confirm ? 'Passwords match' : "Passwords don't match yet"}
          </p>
        ) : null}
      </div>

      <button
        className="button login-submit reset-submit"
        type="submit"
        disabled={isSubmitting || !isPasswordAcceptable(password) || password !== confirm}
      >
        {isSubmitting ? 'Saving…' : 'Reset password'}
      </button>

      <p className="login-form-footer">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
