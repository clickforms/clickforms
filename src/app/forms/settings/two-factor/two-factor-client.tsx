'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <title>Two-factor authentication</title>
      <rect
        x="6.25"
        y="2.5"
        width="7.5"
        height="15"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line
        x1="9"
        y1="4.75"
        x2="11"
        y2="4.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="15" r="0.85" fill="currentColor" />
    </svg>
  );
}

// No dedicated toggle component exists yet in this app for a light card surface (only a
// dark-sidebar theme toggle) — built as a plain button/role="switch" here rather than
// pulling in a form library for one control.
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="settings-toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

// Enrollment (QR code / secret generation / verification) has no backend yet — this
// only toggles the row's local on/off display for now. Wiring it up to a real TOTP flow
// is separate follow-up work, not part of matching this page's visual design.
export function TwoFactorClient() {
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);

  function handleToggle(next: boolean) {
    setEnabled(next);
    if (next) {
      toast.success('Authenticator app setup is coming soon.');
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <p className="settings-page-kicker">Personal profile</p>
        <h1 className="settings-page-title">Two-factor authentication</h1>
        <p className="settings-page-lead">Add an extra layer of security when you sign in.</p>
      </header>

      <div className="card contact-details-card">
        <div className="contact-details-header">
          <span
            className="contact-details-header-icon contact-details-header-icon--lavender"
            aria-hidden="true"
          >
            <PhoneIcon />
          </span>
          <div>
            <h2 className="contact-details-title">Two-factor authentication</h2>
            <p className="contact-details-intro">
              Require a one-time code from your phone in addition to your password.
            </p>
          </div>
        </div>

        <div className="two-factor-body">
          <div className="two-factor-method-row">
            <div>
              <p className="two-factor-method-title">Authenticator app</p>
              <p className="two-factor-method-status">{enabled ? 'Enabled' : 'Not enabled'}</p>
            </div>
            <Toggle checked={enabled} onChange={handleToggle} label="Authenticator app" />
          </div>
        </div>
      </div>
    </div>
  );
}
