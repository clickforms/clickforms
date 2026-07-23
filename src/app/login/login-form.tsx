'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { type FormEvent, useEffect, useState } from 'react';

const REMEMBERED_EMAIL_KEY = 'clickforms.login.rememberedEmail';

function resolveErrorMessage(error: string | undefined): string | null {
  if (!error) return null;
  if (error === 'CredentialsSignin') {
    return 'Incorrect email or password. Please try again.';
  }
  return 'Unable to sign in. Please try again.';
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <title>Show password</title>
      <path
        d="M1.5 11S4.5 4.5 11 4.5 20.5 11 20.5 11 17.5 17.5 11 17.5 1.5 11 1.5 11Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="11" r="2.75" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <title>Hide password</title>
      <path
        d="M2.5 2.5l17 17M9.3 9.4a2.75 2.75 0 0 0 3.9 3.9M6.3 6.4C3.9 7.9 2 11 2 11s3 6.5 9 6.5c1.6 0 3-.4 4.2-1.1M16.4 15.1C18.6 13.5 20 11 20 11s-1.2-2.7-3.6-4.5c-1.5-1.1-3.3-2-5.4-2-.7 0-1.4.1-2 .3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(resolveErrorMessage(initialError));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim();

    const result = await signIn('credentials', {
      email: trimmedEmail,
      password,
      redirect: false,
      callbackUrl,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError(resolveErrorMessage(result.error));
      return;
    }

    if (rememberMe) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmedEmail);
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
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
        <div className="login-password-field">
          <input
            className="text-input login-field-input"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
            placeholder="Enter your password"
          />
          <button
            type="button"
            className="login-password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            disabled={isSubmitting}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </label>

      <label className="login-remember-row">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          disabled={isSubmitting}
        />
        <span>Remember me on this device</span>
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
