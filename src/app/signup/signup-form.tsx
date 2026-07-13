'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';

const FORM_SITUATION_OPTIONS = [
  { value: 'paper_form', label: 'We currently use a PDF or paper form' },
  { value: 'existing_online_form', label: 'We have an existing online form' },
  { value: 'no_form', label: "We don't have a form, but have an idea" },
] as const;

type FormSituation = (typeof FORM_SITUATION_OPTIONS)[number]['value'];

export function SignupForm() {
  const [organizationName, setOrganizationName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formSituation, setFormSituation] = useState<FormSituation | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!formSituation) {
      setError('Select which of the following most applies to you');
      return;
    }
    if (!termsAccepted) {
      setError('You must agree to the Terms of Use to continue');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName,
          firstName,
          lastName,
          email,
          phone,
          formSituation,
          termsAccepted,
        }),
      });
      const data: { error?: string; devVerifyUrl?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not create your account. Please try again.');
        return;
      }

      // Dev-mode convenience — see the devVerifyUrl comment in the API route. Never
      // present once SMTP is configured, so this is a no-op in production.
      if (data.devVerifyUrl) {
        console.log('[dev] signup verification link:', data.devVerifyUrl);
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
      <div className="signup-form">
        <div className="signup-check-email">
          <div className="signup-check-email-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect
                x="3"
                y="6"
                width="22"
                height="16"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.8"
              />
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
            We&apos;ve sent a verification link to <strong>{submittedEmail}</strong>. Click the link
            to set your password and get started.
          </p>
        </div>
        <p className="signup-form-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="signup-form" onSubmit={handleSubmit}>
      {error ? (
        <p className="signup-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <label className="signup-field">
        <span className="signup-field-label">Organisation name</span>
        <input
          className="text-input signup-field-input"
          type="text"
          required
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
          disabled={isSubmitting}
          placeholder="Acme Healthcare"
        />
      </label>

      <div className="signup-field-row">
        <label className="signup-field">
          <span className="signup-field-label">First name</span>
          <input
            className="text-input signup-field-input"
            type="text"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            disabled={isSubmitting}
            autoComplete="given-name"
          />
        </label>

        <label className="signup-field">
          <span className="signup-field-label">Last name</span>
          <input
            className="text-input signup-field-input"
            type="text"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            disabled={isSubmitting}
            autoComplete="family-name"
          />
        </label>
      </div>

      <label className="signup-field">
        <span className="signup-field-label">Work email</span>
        <input
          className="text-input signup-field-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          placeholder="you@company.com.au"
        />
      </label>

      <label className="signup-field">
        <span className="signup-field-label">Phone</span>
        <input
          className="text-input signup-field-input"
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={isSubmitting}
          placeholder="04XX XXX XXX"
        />
      </label>

      <fieldset className="signup-choice-group">
        <legend className="signup-field-label">
          Where are you starting from? <span aria-hidden="true">*</span>
        </legend>
        <div className="signup-choice-list">
          {FORM_SITUATION_OPTIONS.map((option) => {
            const selected = formSituation === option.value;
            return (
              <label
                key={option.value}
                className={selected ? 'signup-choice signup-choice--selected' : 'signup-choice'}
              >
                <input
                  type="radio"
                  name="formSituation"
                  value={option.value}
                  checked={selected}
                  onChange={() => setFormSituation(option.value)}
                  disabled={isSubmitting}
                  required
                />
                <span className="signup-choice-indicator" aria-hidden="true" />
                <span className="signup-choice-label">{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="signup-terms">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
          disabled={isSubmitting}
        />
        <span>I agree to the Clickforms Terms of Use and Privacy Policy.</span>
      </label>

      <button className="button signup-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating workspace…' : 'Create organisation'}
      </button>

      <p className="signup-form-footer">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
