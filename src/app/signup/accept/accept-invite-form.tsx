'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { type FormEvent, useEffect, useState } from 'react';

interface InviteDetails {
  email: string;
  name: string | null;
  roleLabel: string;
  roleDescription: string;
  organizationName: string;
}

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(data.error ?? 'This invite link is invalid or has expired.');
        return;
      }
      setInvite(data as InviteDetails);
      if (data.name) setName(data.name);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invite) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Could not accept this invite.');
        return;
      }

      const signInResult = await signIn('credentials', {
        email: invite.email,
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
          <Link href="/login">Sign in</Link> if you already have an account.
        </p>
      </div>
    );
  }

  if (!invite) {
    return <p className="login-form-footer">Loading invite…</p>;
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="invite-summary">
        <p>
          You&apos;ve been invited to join <strong>{invite.organizationName}</strong> as{' '}
          <strong>{invite.roleLabel}</strong>.
        </p>
        <p className="invite-summary-detail">{invite.roleDescription}</p>
      </div>

      {submitError ? (
        <p className="login-form-error" role="alert">
          {submitError}
        </p>
      ) : null}

      <label className="login-field">
        <span className="login-field-label">Email</span>
        <input
          className="text-input login-field-input"
          type="email"
          value={invite.email}
          disabled
        />
      </label>

      <label className="login-field">
        <span className="login-field-label">Your name</span>
        <input
          className="text-input login-field-input"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSubmitting}
        />
      </label>

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
        {isSubmitting ? 'Joining…' : 'Accept invite'}
      </button>
    </form>
  );
}
