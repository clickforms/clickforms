'use client';

import type { OrgPlan, OrgStatus } from '@prisma/client';
import Link from 'next/link';
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ImageCropEditor } from '@/app/forms/[id]/builder/image-crop-editor';
import { useToast } from '@/components/toast';
import {
  buildUsageBars,
  PLAN_FEATURE_PILLS,
  PLAN_LABELS,
  PLAN_LIMITS,
  type PlanUsage,
} from '@/lib/admin/plan-limits';
import { getErrorMessage, readApiError } from '@/lib/error-message';
import { isCroppableImage } from '@/lib/forms/crop-image';

/** Keep in sync with MAX_LOGO_SIZE_BYTES / the logo MIME allowlist in src/lib/s3.ts —
 * not imported from there because that module is `server-only` (mirrors the same
 * duplication already done for MAX_UPLOAD_SIZE_BYTES in src/app/forms/files/files-client.tsx). */
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

export interface OrganizationProfile {
  id: string;
  name: string;
  subdomain: string;
  abn: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notificationEmail: string | null;
  /** Presigned GET URL, regenerated on every page load — never stored. Null when no
   * logo has been uploaded, or S3 isn't configured (soft-fails, see page.tsx). */
  logoUrl: string | null;
}

export interface OrganizationPlanInfo {
  plan: OrgPlan;
  status: OrgStatus;
  trialEndsAt: string | null;
  renewsAt: string | null;
  usage: PlanUsage;
}

interface OrganisationDetailsClientProps {
  initialOrganization: OrganizationProfile;
  plan: OrganizationPlanInfo;
}

const PLAN_STATUS_BADGE_CLASS: Record<OrgStatus, string> = {
  active: 'badge--success',
  trial: 'badge--draft',
  suspended: 'badge--error',
};

function formatPlanDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Whole days remaining until `iso`, floored at 0 rather than going negative — an already-
 * expired trial is shown as its own distinct message (see the render below), not "-2 days". */
function daysUntil(iso: string): number {
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.2v3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="5.2" r="0.7" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3 4.5 8 8.5 13 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.2 2.8h2.1l.7 2.1-1.3 1.1a8.2 8.2 0 0 0 3.3 3.3l1.1-1.3 2.1.7v2.1c0 .6-.5 1.2-1.1 1.3-4.4.7-8.5-3.4-7.8-7.8.1-.6.7-1.1 1.3-1.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

export function OrganisationDetailsClient({
  initialOrganization,
  plan,
}: OrganisationDetailsClientProps) {
  const toast = useToast();
  // Defaults to Billing when there's something to act on (trial/suspended) so the
  // organisation's own admin lands straight on the thing that needs attention, rather
  // than General's identity fields they weren't looking for.
  const [activeTab, setActiveTab] = useState<'general' | 'billing'>(
    plan.status === 'active' ? 'general' : 'billing',
  );
  const [logoUrl, setLogoUrl] = useState(initialOrganization.logoUrl);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialOrganization.name);
  const [abn, setAbn] = useState(initialOrganization.abn ?? '');
  const [contactName, setContactName] = useState(initialOrganization.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(initialOrganization.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(initialOrganization.contactPhone ?? '');
  const [notificationEmail, setNotificationEmail] = useState(
    initialOrganization.notificationEmail ?? '',
  );
  // Separate from the address itself so switching off doesn't throw away whatever the
  // admin typed — turning it back on inside the same visit restores it, and only an
  // actual save while off clears the stored address (see handleSubmit below).
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    Boolean(initialOrganization.notificationEmail),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSession, setCropSession] = useState<{
    imageSrc: string;
    fileName: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (cropSession) URL.revokeObjectURL(cropSession.imageSrc);
    };
  }, [cropSession]);

  const closeCropSession = useCallback(() => {
    setCropSession((prev) => {
      if (prev) URL.revokeObjectURL(prev.imageSrc);
      return null;
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Organisation name is required');
      return;
    }

    if (notificationsEnabled && !notificationEmail.trim()) {
      setError('Enter a notification email address, or turn notifications off.');
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
          notificationEmail: notificationsEnabled ? notificationEmail.trim() : '',
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

  async function uploadLogo(file: File) {
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast.error(`Logo exceeds the ${MAX_LOGO_SIZE_BYTES / (1024 * 1024)}MB limit.`);
      return;
    }

    setIsUploadingLogo(true);
    try {
      const presignRes = await fetch('/api/organization/logo/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      if (!presignRes.ok) {
        toast.error(await readApiError(presignRes, 'Could not start logo upload'));
        return;
      }
      const { uploadUrl, storageKey } = (await presignRes.json()) as {
        uploadUrl: string;
        storageKey: string;
      };

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) {
        toast.error('Upload to storage failed. Check S3 configuration and try again.');
        return;
      }

      const confirmRes = await fetch('/api/organization/logo/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      if (!confirmRes.ok) {
        toast.error(await readApiError(confirmRes, 'Could not save uploaded logo'));
        return;
      }

      const { logoUrl: newLogoUrl } = (await confirmRes.json()) as { logoUrl: string | null };
      setLogoUrl(newLogoUrl);
      closeCropSession();
      toast.success('Logo updated');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  }

  function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast.error(`Logo exceeds the ${MAX_LOGO_SIZE_BYTES / (1024 * 1024)}MB limit.`);
      return;
    }

    if (!isCroppableImage(file.type)) {
      void uploadLogo(file);
      return;
    }

    setCropSession({
      imageSrc: URL.createObjectURL(file),
      fileName: file.name,
    });
  }

  async function handleEditExistingLogo() {
    if (!logoUrl) return;
    try {
      const res = await fetch(logoUrl);
      if (!res.ok) throw new Error('Could not load the logo.');
      const blob = await res.blob();
      if (blob.type && !isCroppableImage(blob.type)) {
        throw new Error('Cropping isn’t available for this format. Replace with a PNG or JPG.');
      }
      setCropSession({
        imageSrc: URL.createObjectURL(blob),
        fileName: 'logo.png',
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load the logo for editing.'));
    }
  }

  async function handleRemoveLogo() {
    setIsRemovingLogo(true);
    try {
      const res = await fetch('/api/organization/logo', { method: 'DELETE' });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not remove logo'));
        return;
      }
      setLogoUrl(null);
      toast.success('Logo removed');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsRemovingLogo(false);
    }
  }

  return (
    <div className="settings-page organisation-settings">
      <div className="settings-page-header">
        <h1 className="settings-page-title">Organisation settings</h1>
        <p className="settings-page-lead">
          Manage the details that identify your organisation across Clickforms.
        </p>
      </div>

      <div
        className="organisation-settings-tabs"
        role="tablist"
        aria-label="Organisation settings sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'general'}
          className={`organisation-settings-tab${activeTab === 'general' ? ' organisation-settings-tab--active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'billing'}
          className={`organisation-settings-tab${activeTab === 'billing' ? ' organisation-settings-tab--active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          Billing
          {plan.status !== 'active' ? (
            <span className="organisation-settings-tab-dot" aria-hidden="true" />
          ) : null}
        </button>
      </div>

      {activeTab === 'billing' ? (
        <div className="card contact-details-card organisation-plan-card">
          <div className="contact-details-header">
            <span className="contact-details-header-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <title>Plan</title>
                <path
                  d="M10 3 4 6.5v6L10 16l6-3.5v-6L10 3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path d="M10 9.3v6.4" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="m4 6.5 6 2.8 6-2.8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="organisation-plan-heading">
              <div className="contact-details-title-row">
                <h2 className="contact-details-title">{PLAN_LABELS[plan.plan]} plan</h2>
                <span className={`badge ${PLAN_STATUS_BADGE_CLASS[plan.status]}`}>
                  {plan.status === 'trial'
                    ? 'Trial'
                    : plan.status === 'suspended'
                      ? 'Suspended'
                      : 'Active'}
                </span>
              </div>
              <p className="contact-details-intro">
                {plan.status === 'trial' && plan.trialEndsAt ? (
                  daysUntil(plan.trialEndsAt) > 0 ? (
                    <>
                      Your trial ends in {daysUntil(plan.trialEndsAt)} day
                      {daysUntil(plan.trialEndsAt) === 1 ? '' : 's'} (
                      {formatPlanDate(plan.trialEndsAt)}
                      ). Choose a plan before then to keep using Clickforms without interruption.
                    </>
                  ) : (
                    <>
                      Your trial ended on {formatPlanDate(plan.trialEndsAt)}. Choose a plan to
                      continue — sign-in is paused for this organisation until then.
                    </>
                  )
                ) : plan.status === 'suspended' ? (
                  'This organisation is suspended. Contact us to reactivate it.'
                ) : plan.renewsAt ? (
                  <>Renews {formatPlanDate(plan.renewsAt)}.</>
                ) : (
                  "Here's your current usage against this plan's limits."
                )}
              </p>
            </div>
          </div>

          <div className="organisation-plan-section">
            <h3 className="organisation-plan-section-title">Usage</h3>
            <div className="organisation-plan-usage">
              {buildUsageBars(plan.plan, plan.usage).map((bar) => {
                const overLimit = bar.limit !== null && bar.used > bar.limit;
                return (
                  <div key={bar.label} className="usage-bar">
                    <div className="usage-bar-header">
                      <span>{bar.label}</span>
                      <span className={overLimit ? 'usage-bar-value--over' : undefined}>
                        {bar.formatted}
                        {overLimit ? ' · Over limit' : ''}
                      </span>
                    </div>
                    <div className="usage-bar-track">
                      <div
                        className={`usage-bar-fill${overLimit ? ' usage-bar-fill--over' : ''}`}
                        style={{ width: `${bar.percent ?? 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="organisation-plan-section">
            <h3 className="organisation-plan-section-title">What&apos;s included</h3>
            <ul className="organisation-plan-feature-list">
              {PLAN_FEATURE_PILLS.map((feature) => {
                const on = PLAN_LIMITS[plan.plan][feature.key];
                return (
                  <li
                    key={feature.key}
                    className={`organisation-plan-feature${on ? ' organisation-plan-feature--on' : ''}`}
                  >
                    <span className="organisation-plan-feature-icon" aria-hidden="true">
                      {on ? <CheckIcon /> : <CrossIcon />}
                    </span>
                    {feature.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="contact-details-actions organisation-plan-actions">
            <Link href="/pricing" className="button button--dark">
              View plans
            </Link>
            <Link href="/contact" className="button button--ghost">
              Contact us to upgrade
            </Link>
          </div>
        </div>
      ) : null}

      {activeTab === 'general' ? (
        <>
          <div className="card contact-details-card organisation-logo-card">
            <div className="contact-details-header">
              <span className="contact-details-header-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <title>Logo</title>
                  <rect
                    x="3"
                    y="3"
                    width="14"
                    height="14"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <circle cx="7.3" cy="7.5" r="1.3" stroke="currentColor" strokeWidth="1.4" />
                  <path
                    d="M3.8 14.5 8 10.3l2.6 2.6 2-2 3.6 3.6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <div className="contact-details-title-row">
                  <h2 className="contact-details-title">Logo</h2>
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
                  Shown in the top bar in place of the default Clickforms mark. PNG, JPEG, WebP, or
                  GIF — crop and rotate before upload. SVG uploads as-is. Up to{' '}
                  {MAX_LOGO_SIZE_BYTES / (1024 * 1024)}MB.
                </p>
              </div>
            </div>

            <div className="organisation-logo-row">
              <div className="organisation-logo-preview">
                {logoUrl ? (
                  // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize
                  <img src={logoUrl} alt="Organisation logo" />
                ) : (
                  <span className="organisation-logo-placeholder">No logo</span>
                )}
              </div>
              <div className="organisation-logo-actions">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={LOGO_ACCEPT}
                  className="organisation-logo-file-input"
                  onChange={(event) => void handleLogoFileChange(event)}
                  disabled={isUploadingLogo || isRemovingLogo}
                />
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={isUploadingLogo || isRemovingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {isUploadingLogo ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
                </button>
                {logoUrl ? (
                  <>
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={isUploadingLogo || isRemovingLogo}
                      onClick={() => void handleEditExistingLogo()}
                    >
                      Edit & crop
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={isUploadingLogo || isRemovingLogo}
                      onClick={() => void handleRemoveLogo()}
                    >
                      {isRemovingLogo ? 'Removing…' : 'Remove'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {cropSession ? (
            <ImageCropEditor
              key={cropSession.imageSrc}
              open
              imageSrc={cropSession.imageSrc}
              fileName={cropSession.fileName}
              busy={isUploadingLogo}
              onCancel={closeCropSession}
              onApply={uploadLogo}
            />
          ) : null}

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
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {error ? (
                <p className="form-error contact-details-error" role="alert">
                  {error}
                </p>
              ) : null}

              <dl className="contact-details-list organisation-details-list">
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
                      disabled={isSaving}
                    />
                  </dd>
                </div>
                <div className="contact-details-row">
                  <dt>Contact email</dt>
                  <dd>
                    <div className="organisation-field-control">
                      <span className="organisation-field-icon" aria-hidden="true">
                        <MailIcon />
                      </span>
                      <input
                        className="text-input contact-details-input"
                        type="email"
                        value={contactEmail}
                        onChange={(event) => setContactEmail(event.target.value)}
                        placeholder="contact@yourorg.com"
                        disabled={isSaving}
                      />
                    </div>
                  </dd>
                </div>
                <div className="contact-details-row">
                  <dt>Contact phone</dt>
                  <dd>
                    <div className="organisation-field-control">
                      <span className="organisation-field-icon" aria-hidden="true">
                        <PhoneIcon />
                      </span>
                      <input
                        className="text-input contact-details-input"
                        type="tel"
                        value={contactPhone}
                        onChange={(event) => setContactPhone(event.target.value)}
                        placeholder="0400 000 000"
                        disabled={isSaving}
                      />
                    </div>
                  </dd>
                </div>
                <div className="contact-details-row">
                  <dt>
                    <span className="organisation-label-with-help">
                      Notification email
                      <span className="organisation-help">
                        <button
                          type="button"
                          className="organisation-help-button"
                          aria-describedby="notification-email-tooltip"
                          aria-label="About notification email"
                        >
                          <InfoIcon />
                        </button>
                        <span
                          id="notification-email-tooltip"
                          role="tooltip"
                          className="organisation-tooltip"
                        >
                          Sent to this address — with a PDF copy of the response attached — every
                          time someone submits a response to any of your forms. This is just the
                          organisation-wide default: any individual form can still send its own
                          notifications to a different address, or turn them off entirely, from that
                          form&apos;s own Settings page.
                        </span>
                      </span>
                    </span>
                  </dt>
                  <dd>
                    <div className="notification-toggle-row">
                      <Toggle
                        checked={notificationsEnabled}
                        onChange={setNotificationsEnabled}
                        disabled={isSaving}
                        label="Response notification email"
                      />
                      <span
                        className={`notification-toggle-state${notificationsEnabled ? ' notification-toggle-state--on' : ''}`}
                      >
                        {notificationsEnabled ? 'On' : 'Off'}
                      </span>
                    </div>

                    {notificationsEnabled ? (
                      <div className="organisation-field-control">
                        <span className="organisation-field-icon" aria-hidden="true">
                          <MailIcon />
                        </span>
                        <input
                          className="text-input contact-details-input"
                          type="email"
                          value={notificationEmail}
                          onChange={(event) => setNotificationEmail(event.target.value)}
                          placeholder="responses@yourorg.com"
                          disabled={isSaving}
                          required
                        />
                      </div>
                    ) : null}
                  </dd>
                </div>
              </dl>

              <div className="contact-details-actions">
                <button type="submit" className="button button--dark" disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
