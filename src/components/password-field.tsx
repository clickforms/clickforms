'use client';

import { useId, useState } from 'react';
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from '@/lib/users/password';

// Same icon set/markup as the login page's own show/hide toggle (src/app/login/login-form.tsx)
// and the same .login-password-field/.login-password-toggle CSS (globals.css) — that pair was
// built for exactly this `login-field-input` class combo, which every "set your password"
// form (signup verify, org invite accept, platform-admin invite accept) already uses.
// Extracted here once three more forms needed the identical behavior, rather than copying
// this ~60-line pattern a third and fourth time.
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

interface PasswordFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  placeholder?: string;
  showHint?: boolean;
}

/** A password `<input>` with a show/hide toggle — for the "set your password" family of
 * forms (signup verify, invite accept) that already use `.login-field-input` styling. */
export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  disabled,
  placeholder = PASSWORD_HINT,
  showHint = true,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="login-password-field-wrap">
      <div className="login-password-field">
        <input
          id={inputId}
          className="text-input login-field-input"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength ?? PASSWORD_MIN_LENGTH}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="login-password-toggle"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {showHint ? <span className="login-field-hint">{PASSWORD_HINT}</span> : null}
    </div>
  );
}
