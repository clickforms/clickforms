'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { OtpInput } from '@/components/otp-input';

const REMEMBERED_EMAIL_KEY = 'clickforms.login.rememberedEmail';

function resolveErrorMessage(error: string | undefined): ReactNode | null {
  if (!error) return null;
  if (error === 'CredentialsSignin') {
    return 'Incorrect email or password. Please try again.';
  }
  if (error === 'OrganizationSuspended') {
    return 'This organisation has been suspended. Contact support for help.';
  }
  if (error === 'InvalidTwoFactorCode') {
    return 'That code is incorrect or has expired. Check the latest email, or resend a new code.';
  }
  if (error === 'AmbiguousAccount') {
    return "This email and password match more than one of your organisations, so we can't tell which one to sign you into. Please use a different password for each organisation, or contact support for help.";
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

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'•'.repeat(Math.max(local.length - visible.length, 3))}@${domain}`;
}

function MailIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4 7.5l8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const RESEND_SECONDS = 30;

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
  const [error, setError] = useState<ReactNode | null>(resolveErrorMessage(initialError));
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once the server has emailed a verification code (user has two-step on): the form
  // then asks for it and re-submits the same email + password with it.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  async function submitCredentials(withCode: string | undefined) {
    setError(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim();

    const result = await signIn('credentials', {
      email: trimmedEmail,
      password,
      ...(withCode ? { code: withCode } : {}),
      redirect: false,
      callbackUrl,
    });

    setIsSubmitting(false);

    if (result?.error === 'TwoFactorRequired') {
      setNeedsCode(true);
      setCode('');
      setResendIn(RESEND_SECONDS);
      return;
    }

    if (result?.error) {
      setError(resolveErrorMessage(result.error));
      if (result.error === 'InvalidTwoFactorCode') setCode('');
      return;
    }

    if (rememberMe) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmedEmail);
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    const session = await getSession();
    if (session?.user?.isPlatformAdmin && !session.user.organizationId) {
      const nextPath =
        callbackUrl.startsWith('/admin') && !callbackUrl.startsWith('/admin/api')
          ? callbackUrl
          : '/admin';
      router.push(nextPath);
      router.refresh();
      return;
    }

    if (result?.url) {
      router.push(result.url);
      router.refresh();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (needsCode && code.length !== 6) return;
    void submitCredentials(needsCode ? code : undefined);
  }

  // Signing in again without a code makes the server email a fresh one (rate-limited to one
  // per 30 seconds server-side).
  async function handleResend() {
    setNotice(null);
    await submitCredentials(undefined);
    setNotice('A new code is on its way.');
  }

  function handleBackToSignIn() {
    setNeedsCode(false);
    setCode('');
    setError(null);
    setNotice(null);
    setPassword('');
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  if (needsCode) {
    return (
      <form className="login-form login-form--verify" onSubmit={handleSubmit}>
        <div className="verify-header">
          <span className="verify-icon" aria-hidden="true">
            <MailIcon />
          </span>
          <p className="signup-panel-kicker">Two-step verification</p>
          <h2 id="login-panel-title" className="verify-title">
            Check your email
          </h2>
          <p className="verify-lead">
            We sent a 6-digit code to <strong>{maskEmail(email.trim())}</strong>. Enter it below to
            finish signing in.
          </p>
        </div>

        {error ? (
          <p className="login-form-error" role="alert">
            {error}
          </p>
        ) : null}
        {notice && !error ? <p className="verify-notice">{notice}</p> : null}

        <OtpInput
          label="Verification code"
          value={code}
          onChange={(next) => {
            setCode(next);
            if (error) setError(null);
          }}
          onComplete={(complete) => void submitCredentials(complete)}
          disabled={isSubmitting}
          invalid={Boolean(error)}
          autoFocus
        />

        <button
          className="button login-submit"
          type="submit"
          disabled={code.length !== 6 || isSubmitting}
        >
          {isSubmitting ? 'Verifying…' : 'Verify and sign in'}
        </button>

        <div className="verify-footer">
          <p>
            Didn&apos;t get it? Check your spam folder or{' '}
            <button
              type="button"
              className="verify-link"
              onClick={() => void handleResend()}
              disabled={isSubmitting || resendIn > 0}
            >
              {resendIn > 0 ? `resend in ${resendIn}s` : 'resend the code'}
            </button>
            .
          </p>
          <button type="button" className="verify-link" onClick={handleBackToSignIn}>
            ← Back to sign in
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="signup-panel-header">
        <p className="signup-panel-kicker">Sign in</p>
        <h2 id="login-panel-title">Sign in to admin</h2>
        <p>Use your email and password to access Clickforms.</p>
      </div>

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

      <button className="button login-submit" type="submit" disabled={!canSubmit}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="login-form-footer">
        Don&apos;t have an account? <Link href="/signup">Create organisation</Link>
      </p>
    </form>
  );
}
