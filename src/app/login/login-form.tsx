'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { type FormEvent, useState } from 'react';

function resolveErrorMessage(error: string | undefined): string | null {
  if (!error) return null;
  if (error === 'CredentialsSignin') {
    return 'Incorrect email or password. Please try again.';
  }
  return 'Unable to sign in. Please try again.';
}

export function LoginForm({
  callbackUrl,
  initialError,
}: {
  callbackUrl: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(resolveErrorMessage(initialError));
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn('credentials', {
      email: email.trim(),
      password,
      redirect: false,
      callbackUrl,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError(resolveErrorMessage(result.error));
      return;
    }

    if (result?.url) {
      router.push(result.url);
      router.refresh();
    }
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

      <label className="login-field">
        <span className="login-field-label-row">
          <span className="login-field-label">Password</span>
          <Link href="/forgot-password" className="login-field-hint-link">
            Forgot password?
          </Link>
        </span>
        <input
          className="text-input login-field-input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSubmitting}
          placeholder="Enter your password"
        />
      </label>

      <button className="button login-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="login-form-footer">
        Don&apos;t have an account? <Link href="/signup">Create organisation</Link>
        {' · '}
        <Link href="/">Back to home</Link>
      </p>
    </form>
  );
}
