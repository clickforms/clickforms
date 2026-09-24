'use client';

import type { OrgPlan } from '@prisma/client';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { useToast } from '@/components/toast';
import { PLAN_LABELS, PLAN_ORDER } from '@/lib/admin/plan-limits';
import { readApiError } from '@/lib/error-message';

interface OnboardResult {
  organizationId: string;
  inviteUrl: string;
}

export function NewOrganisationClient() {
  const toast = useToast();
  const [organizationName, setOrganizationName] = useState('');
  const [abn, setAbn] = useState('');
  const [plan, setPlan] = useState<OrgPlan>('standard');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<OnboardResult | null>(null);

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied to clipboard');
    } catch {
      toast.error('Could not copy link — select and copy manually');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName, abn, plan, adminName, adminEmail }),
      });
      if (!res.ok) {
        setError(await readApiError(res, 'Could not onboard this organisation'));
        return;
      }
      const data: { organizationId?: string; inviteUrl?: string } = await res.json();

      if (!data.organizationId || !data.inviteUrl) {
        setError('Could not onboard this organisation');
        return;
      }

      setResult({ organizationId: data.organizationId, inviteUrl: data.inviteUrl });
      toast.success('Organisation created — invite link ready');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="settings-page">
        <header className="settings-page-header">
          <p className="settings-page-kicker">Clickforms Admin</p>
          <h1 className="settings-page-title">Organisation created</h1>
          <p className="settings-page-lead">
            Share this invite link with {adminName || 'the new admin'} so they can set a password
            and get started.
          </p>
        </header>

        <div className="card users-invite-banner">
          <p className="users-invite-banner-title">Invite link ready</p>
          <p className="users-invite-banner-text">
            Share this link with {adminEmail}. It expires in 7 days.
          </p>
          <div className="users-invite-link-row">
            <input
              className="text-input"
              readOnly
              value={result.inviteUrl}
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void handleCopyLink(result.inviteUrl)}
            >
              Copy link
            </button>
          </div>
        </div>

        <div className="contact-details-actions">
          <Link href="/admin/organisations" className="button button--ghost">
            Back to organisations
          </Link>
          <Link href={`/admin/organisations/${result.organizationId}`} className="button">
            View organisation
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <p className="settings-page-kicker">Clickforms Admin</p>
        <h1 className="settings-page-title">Onboard a new organisation</h1>
        <p className="settings-page-lead">
          Create the organisation and invite its first admin — they'll set their own password via
          the invite link.
        </p>
      </header>

      <div className="card contact-details-card">
        <div className="contact-details-header">
          <span className="contact-details-header-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <title>New organisation</title>
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
            <h2 className="contact-details-title">Organisation details</h2>
            <p className="contact-details-intro">
              A subdomain is generated automatically from the organisation name.
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
              <dt>Organisation name</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  required
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Acme Healthcare"
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>Billing plan</dt>
              <dd>
                <select
                  className="text-input contact-details-input"
                  value={plan}
                  onChange={(event) => setPlan(event.target.value as OrgPlan)}
                  disabled={isSubmitting}
                >
                  {PLAN_ORDER.map((planOption) => (
                    <option key={planOption} value={planOption}>
                      {PLAN_LABELS[planOption]}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>Admin's name</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  required
                  value={adminName}
                  onChange={(event) => setAdminName(event.target.value)}
                  placeholder="Full name"
                  disabled={isSubmitting}
                />
              </dd>
            </div>
            <div className="contact-details-row">
              <dt>Admin's email</dt>
              <dd>
                <input
                  className="text-input contact-details-input"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder="admin@theirorg.com"
                  disabled={isSubmitting}
                />
              </dd>
            </div>
          </dl>

          <div className="contact-details-actions">
            <Link href="/admin/organisations" className="button button--ghost">
              Cancel
            </Link>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create organisation & send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
