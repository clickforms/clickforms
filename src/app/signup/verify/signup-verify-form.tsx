'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { type FormEvent, useEffect, useState } from 'react';

interface PendingSignupDetails {
  organizationName: string;
  firstName: string;
  email: string;
}

export function SignupVerifyForm({ token }: { token: string }) {
  const router = useRouter();
  const [pendingSignup, setPendingSignup] = useState<PendingSignupDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/auth/signup/verify/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(data.error ?? 'This verification link is invalid or has expired.');
        return;
      }
      setPendingSignup(data as PendingSignupDetails);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingSignup) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/signup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Could not finish setting up your account.');
        return;
      }

      const signInResult = await signIn('credentials', {
        email: pendingSignup.email,
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
          <Link href="/signup">Start signup again</Link>
        </p>
      </div>
    );
  }

  if (!pendingSignup) {
    return <p className="login-form-footer">Loading…</p>;
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="invite-summary">
        <p>
          Setting up <strong>{pendingSignup.organizationName}</strong> for{' '}
          <strong>{pendingSignup.email}</strong>.
        </p>
      </div>

      {submitError ? (
        <p className="login-form-error" role="alert">
          {submitError}
        </p>
      ) : null}

      <label className="login-field">
        <span className="login-field-label">Choose a password</span>
        <input
          className="text-input login-field-input"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
          placeholder="At least 8 characters"
        />
      </label>

      <button className="button login-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Setting up…' : 'Set password & continue'}
      </button>
    </form>
  );
}
