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
      <h1 className="settings-page-title">Account Settings</h1>

      <div className="card contact-details-card">
        <div className="contact-details-header">
          <h2 className="contact-details-title">Contact Details</h2>
          <p className="contact-details-intro">
            Your contact information is essential for us to communicate with you. Update your name
            and phone number below. To change your email address, contact your organisation admin.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error ? (
            <p className="form-error contact-details-error" role="alert">
              {error}
            </p>
          ) : null}

          <dl className="contact-details-list">
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
              <dt>Email address</dt>
              <dd className="contact-details-readonly">{initialProfile.email}</dd>
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
          </dl>

          <div className="contact-details-actions">
            <button type="submit" className="button" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
