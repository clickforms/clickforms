'use client';

import { type FormEvent, useState } from 'react';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
}

interface UserDetailsClientProps {
  initialProfile: UserProfile;
}

export function UserDetailsClient({ initialProfile }: UserDetailsClientProps) {
  const toast = useToast();
  const [name, setName] = useState(initialProfile.name ?? '');
  const [phone, setPhone] = useState(initialProfile.phone ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
        }),
      });

      if (!res.ok) {
        setError(await readApiError(res, 'Could not save your details'));
        return;
      }

      toast.success('Contact details saved');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <p className="settings-page-kicker">Personal profile</p>
        <h1 className="settings-page-title">Account settings</h1>
        <p className="settings-page-lead">
          Keep the details your team uses to identify and contact you up to date.
        </p>
      </header>

      <div className="card contact-details-card contact-details-card--profile">
        <div className="contact-details-header">
          <span className="contact-details-header-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <title>Profile</title>
              <circle cx="10" cy="6.75" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M4.5 16c.4-2.55 2.7-4.25 5.5-4.25s5.1 1.7 5.5 4.25"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div>
            <h2 className="contact-details-title">Contact details</h2>
            <p className="contact-details-intro">
              Update the details your team uses to recognise and contact you. Your email is managed
              by your organisation.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error ? (
            <p className="form-error contact-details-error" role="alert">
              {error}
            </p>
          ) : null}

          <dl className="contact-details-list contact-details-list--table contact-details-list--wide-inputs">
            <div className="contact-details-row">
              <dt>Full name</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  disabled={isSaving}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>Phone</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0400 000 000"
                  disabled={isSaving}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>Email address</dt>
              <dd className="contact-details-readonly">
                <span className="contact-details-readonly-value">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <title>Email</title>
                    <rect
                      x="1.5"
                      y="3.5"
                      width="13"
                      height="9"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    <path
                      d="M2 4.5l6 4.5 6-4.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {initialProfile.email}
                </span>
                <span className="contact-details-readonly-note">Contact an admin to update</span>
              </dd>
            </div>
          </dl>

          <div className="contact-details-actions">
            <p>Changes are saved to your profile immediately.</p>
            <button type="submit" className="button" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
