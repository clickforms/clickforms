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
      <h1 className="settings-page-title">Organisation settings</h1>

      <div className="card contact-details-card">
        <div className="contact-details-header">
          <span className="contact-details-header-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <title>Organisation</title>
              <rect
                x="4"
                y="6.5"
                width="12"
                height="9.5"
                rx="1.2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M7.5 6.5V5.3c0-.66.54-1.2 1.2-1.2h2.6c.66 0 1.2.54 1.2 1.2v1.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M4 10.5h12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          <div>
            <div className="contact-details-title-row">
              <h2 className="contact-details-title">Organisation details</h2>
              <span className="contact-details-scope-badge">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <title>Admins only</title>
                  <rect
                    x="4"
                    y="7"
                    width="8"
                    height="6"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M5.5 7V5.5a2.5 2.5 0 015 0V7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                Admins only
              </span>
            </div>
            <p className="contact-details-intro">
              These details identify your organisation and give us someone to contact about your
              account. ABN is optional.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error ? (
            <p className="form-error contact-details-error" role="alert">
              {error}
            </p>
          ) : null}

          <dl className="contact-details-list contact-details-list--stacked">
            <div className="contact-details-row">
              <dt>Organisation name:</dt>
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
              <dt>ABN:</dt>
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
              <dt>Contact person:</dt>
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
              <dt>Contact email:</dt>
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
              <dt>Contact phone:</dt>
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
