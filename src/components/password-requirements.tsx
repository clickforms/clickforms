'use client';

import './password-requirements.css';

// Mirrors isStrongPassword() in src/lib/users/password.ts (the API enforces it); kept as plain
// regexes here because that module also pulls in server-only crypto code.
export function passwordChecks(password: string) {
  return [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'upper', label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { id: 'number', label: 'One number', met: /\d/.test(password) },
    { id: 'special', label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function isPasswordAcceptable(password: string): boolean {
  return passwordChecks(password).every((check) => check.met);
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/** Live checklist plus a strength meter under a "choose a password" field. */
export function PasswordRequirements({ password }: { password: string }) {
  const checks = passwordChecks(password);
  const metCount = checks.filter((check) => check.met).length;
  // A long password earns the top level even though the four rules are the only hard requirement.
  const level =
    password.length === 0 ? 0 : metCount === 4 && password.length >= 12 ? 4 : Math.min(metCount, 3);

  return (
    <div className="pw-req">
      <div className="pw-req-meter" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={`pw-req-segment${level >= segment ? ` pw-req-segment--on pw-req-segment--${level}` : ''}`}
          />
        ))}
      </div>
      <p className="pw-req-strength" aria-live="polite">
        {level > 0 ? `Password strength: ${STRENGTH_LABELS[level]}` : 'Choose a password'}
      </p>
      <ul className="pw-req-list">
        {checks.map((check) => (
          <li key={check.id} className={check.met ? 'pw-req-item pw-req-item--met' : 'pw-req-item'}>
            <span className="pw-req-tick" aria-hidden="true">
              {check.met ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 6.2l2.3 2.3 4.7-5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            {check.label}
            <span className="pw-req-sr">{check.met ? ' (met)' : ' (not met yet)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
