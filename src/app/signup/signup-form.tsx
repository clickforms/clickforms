'use client';

import Link from 'next/link';
import { type FormEvent, useRef, useState } from 'react';
import './signup-validation.css';
import {
  validateEmailField,
  validateNameField,
  validateOrganisationNameField,
  validatePhoneField,
} from '@/lib/validation/contact-fields';

const FORM_SITUATION_OPTIONS = [
  { value: 'paper_form', label: 'We currently use a PDF or paper form' },
  { value: 'existing_online_form', label: 'We have an existing online form' },
  { value: 'no_form', label: "We don't have a form, but have an idea" },
] as const;

type FormSituation = (typeof FORM_SITUATION_OPTIONS)[number]['value'];

type FieldName =
  | 'organizationName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'formSituation'
  | 'terms';

export function SignupForm() {
  const [organizationName, setOrganizationName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formSituation, setFormSituation] = useState<FormSituation | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  function check(field: FieldName): string | null {
    switch (field) {
      case 'organizationName':
        return validateOrganisationNameField(organizationName);
      case 'firstName':
        return validateNameField(firstName, 'First name');
      case 'lastName':
        return validateNameField(lastName, 'Last name');
      case 'email':
        return validateEmailField(email);
      case 'phone':
        return validatePhoneField(phone);
      case 'formSituation':
        return formSituation
          ? null
          : 'Select which of these best describes where you are starting.';
      case 'terms':
        return termsAccepted ? null : 'You must agree to the Terms of Use to continue.';
    }
  }

  function validateField(field: FieldName) {
    const message = check(field);
    setFieldErrors((current) => {
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  // Re-validates a field only once it has shown an error, so people aren't nagged while typing
  // but see the error clear as soon as they fix it.
  function revalidateIfInvalid(field: FieldName) {
    if (fieldErrors[field]) validateField(field);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAccountExists(false);

    const order: FieldName[] = [
      'organizationName',
      'firstName',
      'lastName',
      'email',
      'phone',
      'formSituation',
      'terms',
    ];
    const errors: Partial<Record<FieldName, string>> = {};
    for (const field of order) {
      const message = check(field);
      if (message) errors[field] = message;
    }
    setFieldErrors(errors);
    const firstInvalid = order.find((field) => errors[field]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[data-field="${firstInvalid}"]`)?.focus();
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
      const data: { error?: string; code?: string; devVerifyUrl?: string } = await res.json();
      if (!res.ok) {
        if (data.code === 'account_exists') {
          setAccountExists(true);
          return;
        }
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

  const canSubmit = !isSubmitting;

  if (submittedEmail) {
    return (
      <div className="signup-form landing-anim landing-anim--1">
        <div className="signup-check-email">
          <div className="signup-check-email-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
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
    <form className="signup-form" onSubmit={handleSubmit} noValidate ref={formRef}>
      {error ? (
        <p className="signup-form-error" role="alert">
          {error}
        </p>
      ) : null}
      {accountExists ? (
        <p className="signup-form-error" role="alert">
          An account with <strong>{email.trim()}</strong> already exists.{' '}
          <Link href="/login">Sign in</Link> or{' '}
          <Link href="/forgot-password">reset your password</Link>, or use a different email
          address.
        </p>
      ) : null}

      <label className="signup-field">
        <span className="signup-field-label">Organisation name</span>
        <input
          className="text-input signup-field-input"
          type="text"
          required
          value={organizationName}
          onChange={(event) => {
            setOrganizationName(event.target.value);
            revalidateIfInvalid('organizationName');
          }}
          onBlur={() => validateField('organizationName')}
          disabled={isSubmitting}
          data-field="organizationName"
          aria-invalid={fieldErrors.organizationName ? true : undefined}
          aria-describedby={fieldErrors.organizationName ? 'err-organizationName' : undefined}
        />
        {fieldErrors.organizationName ? (
          <span className="signup-field-error" id="err-organizationName" role="alert">
            {fieldErrors.organizationName}
          </span>
        ) : null}
      </label>

      <div className="signup-field-row">
        <label className="signup-field">
          <span className="signup-field-label">First name</span>
          <input
            className="text-input signup-field-input"
            type="text"
            required
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
              revalidateIfInvalid('firstName');
            }}
            onBlur={() => validateField('firstName')}
            disabled={isSubmitting}
            data-field="firstName"
            aria-invalid={fieldErrors.firstName ? true : undefined}
            aria-describedby={fieldErrors.firstName ? 'err-firstName' : undefined}
            autoComplete="given-name"
          />
          {fieldErrors.firstName ? (
            <span className="signup-field-error" id="err-firstName" role="alert">
              {fieldErrors.firstName}
            </span>
          ) : null}
        </label>

        <label className="signup-field">
          <span className="signup-field-label">Last name</span>
          <input
            className="text-input signup-field-input"
            type="text"
            required
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value);
              revalidateIfInvalid('lastName');
            }}
            onBlur={() => validateField('lastName')}
            disabled={isSubmitting}
            data-field="lastName"
            aria-invalid={fieldErrors.lastName ? true : undefined}
            aria-describedby={fieldErrors.lastName ? 'err-lastName' : undefined}
            autoComplete="family-name"
          />
          {fieldErrors.lastName ? (
            <span className="signup-field-error" id="err-lastName" role="alert">
              {fieldErrors.lastName}
            </span>
          ) : null}
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
          onChange={(event) => {
            setEmail(event.target.value);
            revalidateIfInvalid('email');
          }}
          onBlur={() => validateField('email')}
          disabled={isSubmitting}
          data-field="email"
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? 'err-email' : undefined}
        />
        {fieldErrors.email ? (
          <span className="signup-field-error" id="err-email" role="alert">
            {fieldErrors.email}
          </span>
        ) : null}
      </label>

      <label className="signup-field">
        <span className="signup-field-label">Phone</span>
        <input
          className="text-input signup-field-input"
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
            revalidateIfInvalid('phone');
          }}
          onBlur={() => validateField('phone')}
          disabled={isSubmitting}
          data-field="phone"
          aria-invalid={fieldErrors.phone ? true : undefined}
          aria-describedby={fieldErrors.phone ? 'err-phone' : undefined}
        />
        {fieldErrors.phone ? (
          <span className="signup-field-error" id="err-phone" role="alert">
            {fieldErrors.phone}
          </span>
        ) : null}
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
                  onChange={() => {
                    setFormSituation(option.value);
                    setFieldErrors((current) => {
                      const next = { ...current };
                      delete next.formSituation;
                      return next;
                    });
                  }}
                  data-field={
                    option.value === FORM_SITUATION_OPTIONS[0].value ? 'formSituation' : undefined
                  }
                  disabled={isSubmitting}
                  required
                />
                <span className="signup-choice-indicator" aria-hidden="true" />
                <span className="signup-choice-label">{option.label}</span>
              </label>
            );
          })}
        </div>
        {fieldErrors.formSituation ? (
          <p className="signup-choice-group-error" role="alert">
            {fieldErrors.formSituation}
          </p>
        ) : null}
      </fieldset>

      <label className="signup-terms">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => {
            setTermsAccepted(event.target.checked);
            if (event.target.checked) {
              setFieldErrors((current) => {
                const next = { ...current };
                delete next.terms;
                return next;
              });
            }
          }}
          disabled={isSubmitting}
          data-field="terms"
        />
        <span>I agree to the Clickforms Terms of Use and Privacy Policy.</span>
      </label>
      {fieldErrors.terms ? (
        <p className="signup-terms-error" role="alert">
          {fieldErrors.terms}
        </p>
      ) : null}

      <button className="button signup-submit" type="submit" disabled={!canSubmit}>
        {isSubmitting ? 'Creating workspace…' : 'Create organisation'}
      </button>

      <p className="signup-form-footer">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
