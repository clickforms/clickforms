'use client';

import { type FormEvent, useState } from 'react';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';

export interface OrganizationProfile {
  id: string;
  name: string;
  subdomain: string;
  abn: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

interface OrganisationDetailsClientProps {
  initialOrganization: OrganizationProfile;
}

export function OrganisationDetailsClient({ initialOrganization }: OrganisationDetailsClientProps) {
  const toast = useToast();
  const [name, setName] = useState(initialOrganization.name);
  const [abn, setAbn] = useState(initialOrganization.abn ?? '');
  const [contactName, setContactName] = useState(initialOrganization.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(initialOrganization.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(initialOrganization.contactPhone ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Organisation name is required');
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch('/api/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          abn: abn.trim(),
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
        }),
      });

      if (!res.ok) {
        setError(await readApiError(res, 'Could not save organisation details'));
        return;
      }

      toast.success('Organisation details saved');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Organisation Settings</h1>

      <div className="card contact-details-card">
        <div className="contact-details-header">
          <h2 className="contact-details-title">Organisation Details</h2>
          <p className="contact-details-intro">
            These details identify your organisation and give us someone to contact about your
            account. ABN is optional. Only organisation admins can view or edit this page.
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
              <dt>Organisation name</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isSaving}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>ABN</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  value={abn}
                  onChange={(event) => setAbn(event.target.value)}
                  placeholder="11 222 333 444"
                  inputMode="numeric"
                  disabled={isSaving}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>Contact person</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Full name"
                  disabled={isSaving}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>Contact email</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="contact@yourorg.com"
                  disabled={isSaving}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>Contact phone</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  type="tel"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
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
