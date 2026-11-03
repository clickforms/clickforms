'use client';

import { useRouter } from 'next/navigation';
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

async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return response.ok ? { ok: true } : { ok: false, error: data.error };
  } catch {
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

type Step = 'idle' | 'enter-code' | 'confirm-disable';

// Email-code two-step verification: when on, signing in also needs a 6-digit code emailed to
// the account address. Turning it on first sends a code to prove the inbox works (so a typo'd
// or dead address can't lock the owner out); turning it off needs the account password.
export function TwoFactorClient({
  initialEnabled,
  email,
}: {
  initialEnabled: boolean;
  email: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>('idle');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function startEnable() {
    setBusy(true);
    const result = await postJson('/api/me/two-factor/send');
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? 'Could not send the code.');
      return;
    }
    setCode('');
    setStep('enter-code');
    toast.success(`Code sent to ${email}`);
  }

  async function confirmEnable() {
    setBusy(true);
    const result = await postJson('/api/me/two-factor/enable', { code });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? 'That code is incorrect or has expired.');
      return;
    }
    setEnabled(true);
    setStep('idle');
    toast.success('Two-step verification is on.');
    router.refresh();
  }

  async function confirmDisable() {
    setBusy(true);
    const result = await postJson('/api/me/two-factor/disable', { password });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? 'Could not turn off two-step verification.');
      return;
    }
    setEnabled(false);
    setStep('idle');
    setPassword('');
    toast.success('Two-step verification is off.');
    router.refresh();
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
            <h2 className="contact-details-title">Email verification code</h2>
            <p className="contact-details-intro">
              When you sign in, we email a 6-digit code to {email || 'your account email'}. You
              enter it after your password.
            </p>
          </div>
        </div>

        <div className="two-factor-body">
          <div className="two-factor-method-row">
            <div>
              <p className="two-factor-method-title">Email code</p>
              <p className="two-factor-method-status">{enabled ? 'Enabled' : 'Not enabled'}</p>
            </div>
            <Toggle
              checked={enabled || step === 'enter-code'}
              disabled={busy}
              label="Email verification code"
              onChange={(next) => {
                if (next) void startEnable();
                else if (enabled) setStep('confirm-disable');
                else setStep('idle');
              }}
            />
          </div>

          {step === 'enter-code' ? (
            <div className="two-factor-step">
              <label className="settings-field">
                <span className="settings-label">Enter the 6-digit code we emailed you</span>
                <input
                  className="text-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                />
              </label>
              <div className="two-factor-actions">
                <button
                  type="button"
                  className="button button--small"
                  disabled={busy || code.length !== 6}
                  onClick={() => void confirmEnable()}
                >
                  Turn on
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  disabled={busy}
                  onClick={() => void startEnable()}
                >
                  Resend code
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  disabled={busy}
                  onClick={() => setStep('idle')}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {step === 'confirm-disable' ? (
            <div className="two-factor-step">
              <label className="settings-field">
                <span className="settings-label">Enter your password to turn this off</span>
                <input
                  className="text-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <div className="two-factor-actions">
                <button
                  type="button"
                  className="button button--small"
                  disabled={busy || password.length === 0}
                  onClick={() => void confirmDisable()}
                >
                  Turn off
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  disabled={busy}
                  onClick={() => {
                    setStep('idle');
                    setPassword('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
