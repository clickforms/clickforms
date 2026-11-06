'use client';

import type { OrgPlan, OrgStatus } from '@prisma/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ImageCropEditor } from '@/app/forms/[id]/builder/image-crop-editor';
import { useToast } from '@/components/toast';
import { buildUsageBars, PLAN_LABELS, type PlanUsage } from '@/lib/admin/plan-limits';
import { getErrorMessage, readApiError } from '@/lib/error-message';
import { isCroppableImage } from '@/lib/forms/crop-image';
import type { OrgPreheader } from '@/lib/org-preheader';
import { HelpTip } from './help-tip';
import { PreheaderPanel } from './preheader-panel';
import './organisation.css';
import { formatShortDate } from '@/lib/format-date';

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
  preheader: OrgPreheader | null;
  /** Presigned URL of the pre-header's own uploaded logo, if any. */
  preheaderLogoUrl: string | null;
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
  /** Absolute origin for this org's public subdomain, e.g. https://carecircle.clickforms.com.au */
  publicOrigin: string;
}

const TAB_LEADS: Record<'general' | 'system' | 'billing', string> = {
  general: 'Your organisation’s identity and contact details.',
  system: 'Response notifications and the header shown at the top of new forms.',
  billing: 'Your current plan, renewal date and what you’ve used this month.',
};

function formatPlanDate(iso: string): string {
  return formatShortDate(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

/** Calendar days from today to `iso`, using the date portion only so a trial set for
 * today is "0" (ends today) rather than "1" from leftover hours until midnight. */
function daysUntil(iso: string): number {
  const now = new Date();
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return Math.round((targetUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.2 4.2 5.8 3.2h4.4l.6 1H13a1.2 1.2 0 0 1 1.2 1.2v6.2A1.2 1.2 0 0 1 13 12.8H3A1.2 1.2 0 0 1 1.8 11.6V5.4A1.2 1.2 0 0 1 3 4.2h2.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8.3" r="2.1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.5 5.5V3.9A1.4 1.4 0 0 0 9.1 2.5H3.9A1.4 1.4 0 0 0 2.5 3.9v5.2A1.4 1.4 0 0 0 3.9 10.5H5.5"
        stroke="currentColor"
        strokeWidth="1.4"
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

function Section({
  branded,
  title,
  description,
  aside,
  children,
}: {
  /** System-tab styling: white head instead of the tinted strip. */
  branded?: boolean;
  title: string;
  /** Shown as an ⓘ tooltip beside the title rather than a line of text. */
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`org-section${branded ? ' org-section--branded' : ''}`}>
      <header className="org-section-head">
        <h2 className="org-section-title org-title-with-help">
          {title}
          {description ? <HelpTip label={`About ${title}`}>{description}</HelpTip> : null}
        </h2>
        {aside ? <div className="org-section-aside">{aside}</div> : null}
      </header>
      <div className="org-section-body">{children}</div>
    </section>
  );
}

function Row({
  label,
  htmlFor,
  hint,
  action,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="org-row">
      <div className="org-row-copy">
        <span className="org-label-with-help">
          {htmlFor ? (
            <label htmlFor={htmlFor}>{label}</label>
          ) : (
            <span className="org-row-label">{label}</span>
          )}
          {hint ? <HelpTip label={`About ${label}`}>{hint}</HelpTip> : null}
        </span>
      </div>
      <div className="org-row-control">{children}</div>
      {action ? <div className="org-row-action">{action}</div> : null}
    </div>
  );
}

export function OrganisationDetailsClient({
  initialOrganization,
  plan,
  publicOrigin,
}: OrganisationDetailsClientProps) {
  const toast = useToast();
  const searchParams = useSearchParams();
  // Opens on the tab named in ?tab= (kept in sync below, so a refresh stays put), else
  // General. The trial reminder lives in the header badge and the Billing tab's dot rather
  // than forcing every visit onto Billing. /forms/organisation/plan redirects back with
  // ?tab=billing after a switch.
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTabState] = useState<'general' | 'system' | 'billing'>(
    tabParam === 'billing' || tabParam === 'system' ? tabParam : 'general',
  );
  function setActiveTab(next: 'general' | 'system' | 'billing') {
    setActiveTabState(next);
    const url = new URL(window.location.href);
    if (next === 'general') url.searchParams.delete('tab');
    else url.searchParams.set('tab', next);
    window.history.replaceState(window.history.state, '', url);
  }
  // Actually changing plans now happens on its own page (/forms/organisation/plan —
  // see ChangePlanClient), which re-fetches fresh org data from the server on the way
  // back rather than patching this state in place, so `plan` no longer needs to be
  // local state here.
  const planInfo = plan;
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
  const [savedSnapshot, setSavedSnapshot] = useState({
    name: initialOrganization.name,
    abn: initialOrganization.abn ?? '',
    contactName: initialOrganization.contactName ?? '',
    contactEmail: initialOrganization.contactEmail ?? '',
    contactPhone: initialOrganization.contactPhone ?? '',
    notificationEmail: initialOrganization.notificationEmail ?? '',
    notificationsEnabled: Boolean(initialOrganization.notificationEmail),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSession, setCropSession] = useState<{
    imageSrc: string;
    fileName: string;
  } | null>(null);

  const isDirty =
    name.trim() !== savedSnapshot.name ||
    abn.trim() !== savedSnapshot.abn ||
    contactName.trim() !== savedSnapshot.contactName ||
    contactEmail.trim() !== savedSnapshot.contactEmail ||
    contactPhone.trim() !== savedSnapshot.contactPhone ||
    notificationsEnabled !== savedSnapshot.notificationsEnabled ||
    (notificationsEnabled && notificationEmail.trim() !== savedSnapshot.notificationEmail);

  const publicHost =
    (publicOrigin ?? '').replace(/^https?:\/\//, '') || initialOrganization.subdomain;

  useEffect(() => {
    return () => {
      if (cropSession) URL.revokeObjectURL(cropSession.imageSrc);
    };
  }, [cropSession]);

  // Safari can restore a stale sideways scroll offset on the (scrollbar-less) app frame
  // after a refresh, pushing the sidebar off-screen. Snap everything back to the left edge
  // once on mount, and again after the browser's own scroll restoration has run.
  useEffect(() => {
    const reset = () => {
      for (const el of [
        document.documentElement,
        document.body,
        document.querySelector('.admin-shell'),
        document.querySelector('.admin-main'),
      ]) {
        if (el && el.scrollLeft !== 0) el.scrollLeft = 0;
      }
    };
    reset();
    const frame = requestAnimationFrame(reset);
    const timer = window.setTimeout(reset, 300);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

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

      setSavedSnapshot({
        name: trimmedName,
        abn: abn.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        notificationEmail: notificationsEnabled ? notificationEmail.trim() : '',
        notificationsEnabled,
      });
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

  async function copyPublicHost() {
    try {
      await navigator.clipboard.writeText(publicHost);
      toast.success('Copied public URL');
    } catch {
      toast.error('Could not copy');
    }
  }

  function discardChanges() {
    setName(savedSnapshot.name);
    setAbn(savedSnapshot.abn);
    setContactName(savedSnapshot.contactName);
    setContactEmail(savedSnapshot.contactEmail);
    setContactPhone(savedSnapshot.contactPhone);
    setNotificationEmail(savedSnapshot.notificationEmail);
    setNotificationsEnabled(savedSnapshot.notificationsEnabled);
    setError(null);
  }

  const trialDays = planInfo.trialEndsAt ? daysUntil(planInfo.trialEndsAt) : 0;
  const statusLabel =
    planInfo.status === 'trial'
      ? 'Trial'
      : planInfo.status === 'suspended'
        ? 'Suspended'
        : 'Active';
  const busyLogo = isUploadingLogo || isRemovingLogo;
  const tabs: { id: 'general' | 'system' | 'billing'; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'system', label: 'System' },
    { id: 'billing', label: 'Billing' },
  ];

  return (
    <div className="org-settings org-ws">
      <header className="org-settings-header">
        <div>
          <h1 className="org-settings-title">Organisation</h1>
          <p className="org-settings-lead">{TAB_LEADS[activeTab]}</p>
        </div>
        <div className="org-tabs" role="tablist" aria-label="Organisation settings sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`org-tab${activeTab === tab.id ? ' org-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'billing' && planInfo.status !== 'active' ? (
                <span className="org-tab-dot" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <div className="org-ws-content">
        {activeTab === 'general' || activeTab === 'system' ? (
          <form id="org-general-form" className="org-settings-stack" onSubmit={handleSubmit}>
            {error ? (
              <p className="form-error org-settings-error" role="alert">
                {error}
              </p>
            ) : null}

            {activeTab === 'general' ? (
              <>
                <section className="org-card org-identity-card">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept={LOGO_ACCEPT}
                    className="org-file-input"
                    onChange={(event) => void handleLogoFileChange(event)}
                    disabled={busyLogo}
                  />
                  <button
                    type="button"
                    className="org-logo"
                    disabled={busyLogo}
                    onClick={() => logoInputRef.current?.click()}
                    aria-label={logoUrl ? 'Replace organisation logo' : 'Upload organisation logo'}
                  >
                    {logoUrl ? (
                      // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize
                      <img src={logoUrl} alt="" />
                    ) : (
                      <span className="org-logo-initials">
                        {orgInitials(name || 'Organisation')}
                      </span>
                    )}
                    <span className="org-logo-overlay">
                      {isUploadingLogo ? '…' : <CameraIcon />}
                    </span>
                  </button>
                  <div className="org-identity-copy">
                    <div className="org-card-name-row">
                      <h2 className="org-card-name">{name.trim() || 'Untitled organisation'}</h2>
                      <span className="org-status-pill" data-status={planInfo.status}>
                        {PLAN_LABELS[planInfo.plan]} · {statusLabel}
                      </span>
                    </div>
                    <div className="org-card-url">
                      <span title={publicOrigin}>{publicHost}</span>
                      <button
                        type="button"
                        className="org-icon-button"
                        onClick={() => void copyPublicHost()}
                        aria-label="Copy public URL"
                      >
                        <CopyIcon />
                      </button>
                    </div>
                    <div className="org-identity-actions">
                      <button
                        type="button"
                        className="button button--small org-button-primary"
                        disabled={busyLogo}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {isUploadingLogo ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
                      </button>
                      {logoUrl ? (
                        <>
                          <button
                            type="button"
                            className="button button--ghost button--small"
                            disabled={busyLogo}
                            onClick={() => void handleEditExistingLogo()}
                          >
                            Crop
                          </button>
                          <button
                            type="button"
                            className="button button--ghost button--small org-button-danger"
                            disabled={busyLogo}
                            onClick={() => void handleRemoveLogo()}
                          >
                            {isRemovingLogo ? 'Removing…' : 'Remove'}
                          </button>
                        </>
                      ) : null}
                      <HelpTip label="Logo file types">
                        PNG, JPG, WebP, GIF or SVG, up to {MAX_LOGO_SIZE_BYTES / (1024 * 1024)}MB.
                      </HelpTip>
                    </div>
                  </div>
                </section>

                <div className="org-grid-2">
                  <Section title="Profile">
                    <Row label="Organisation name" htmlFor="org-name">
                      <input
                        id="org-name"
                        className="text-input org-input"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={isSaving}
                      />
                    </Row>
                    <Row label="ABN" htmlFor="org-abn">
                      <input
                        id="org-abn"
                        className="text-input org-input"
                        value={abn}
                        onChange={(event) => setAbn(event.target.value)}
                        placeholder="11 222 333 444"
                        inputMode="numeric"
                        disabled={isSaving}
                      />
                    </Row>
                    <Row label="Public URL">
                      <div className="org-readonly">
                        <span title={publicOrigin}>{publicHost}</span>
                        <button
                          type="button"
                          className="org-icon-button"
                          onClick={() => void copyPublicHost()}
                          aria-label="Copy public URL"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                    </Row>
                  </Section>

                  <Section title="Contact">
                    <Row label="Contact person" htmlFor="org-contact-name">
                      <input
                        id="org-contact-name"
                        className="text-input org-input"
                        value={contactName}
                        onChange={(event) => setContactName(event.target.value)}
                        placeholder="Full name"
                        disabled={isSaving}
                      />
                    </Row>
                    <Row label="Contact email" htmlFor="org-contact-email">
                      <input
                        id="org-contact-email"
                        className="text-input org-input"
                        type="email"
                        value={contactEmail}
                        onChange={(event) => setContactEmail(event.target.value)}
                        placeholder="contact@yourorg.com"
                        disabled={isSaving}
                      />
                    </Row>
                    <Row label="Contact phone" htmlFor="org-contact-phone">
                      <input
                        id="org-contact-phone"
                        className="text-input org-input"
                        type="tel"
                        value={contactPhone}
                        onChange={(event) => setContactPhone(event.target.value)}
                        placeholder="0400 000 000"
                        disabled={isSaving}
                      />
                    </Row>
                  </Section>
                </div>

                <div className={`org-savebar${isDirty ? ' org-savebar--dirty' : ''}`}>
                  <p>{isDirty ? 'You have unsaved changes' : 'All changes saved'}</p>
                  <div className="org-savebar-actions">
                    {isDirty ? (
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        disabled={isSaving}
                        onClick={discardChanges}
                      >
                        Discard
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="button button--small org-button-primary"
                      disabled={isSaving || !isDirty}
                    >
                      {isSaving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === 'system' ? (
              <>
                <Section
                  branded
                  title="Notifications"
                  description="Default for every form when someone submits. Forms can override this."
                >
                  <Row label="Email me new responses" hint="Sends a PDF copy of each submission.">
                    <div className="org-toggle-value">
                      <Toggle
                        checked={notificationsEnabled}
                        onChange={setNotificationsEnabled}
                        disabled={isSaving}
                        label="Response notification email"
                      />
                      <span>{notificationsEnabled ? 'On' : 'Off'}</span>
                    </div>
                  </Row>
                  {notificationsEnabled ? (
                    <Row label="Notification email" htmlFor="org-notify-email">
                      <input
                        id="org-notify-email"
                        className="text-input org-input"
                        type="email"
                        value={notificationEmail}
                        onChange={(event) => setNotificationEmail(event.target.value)}
                        placeholder="responses@yourorg.com"
                        disabled={isSaving}
                        required
                      />
                    </Row>
                  ) : null}
                </Section>
                {isDirty ? (
                  <div className={`org-savebar${isDirty ? ' org-savebar--dirty' : ''}`}>
                    <p>{isDirty ? 'You have unsaved changes' : 'All changes saved'}</p>
                    <div className="org-savebar-actions">
                      {isDirty ? (
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          disabled={isSaving}
                          onClick={discardChanges}
                        >
                          Discard
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        className="button button--small org-button-primary"
                        disabled={isSaving || !isDirty}
                      >
                        {isSaving ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                ) : null}
                <PreheaderPanel
                  orgName={name.trim() || initialOrganization.name}
                  orgLogoUrl={logoUrl}
                  initialCustomLogoUrl={initialOrganization.preheaderLogoUrl}
                  initial={initialOrganization.preheader}
                />
              </>
            ) : null}
          </form>
        ) : null}

        {activeTab === 'billing' ? (
          <div className="org-settings-stack">
            {planInfo.status !== 'active' ? (
              <div
                className={`org-banner${planInfo.status === 'suspended' ? ' org-banner--danger' : ' org-banner--warning'}`}
                role="status"
              >
                <div>
                  <p className="org-banner-title">
                    {planInfo.status === 'trial'
                      ? trialDays > 0
                        ? `Trial ends in ${trialDays} day${trialDays === 1 ? '' : 's'}`
                        : trialDays === 0
                          ? 'Trial ends today'
                          : 'Trial ended'
                      : 'Organisation suspended'}
                  </p>
                  <p className="org-banner-body">
                    {planInfo.status === 'trial' && planInfo.trialEndsAt ? (
                      trialDays >= 0 ? (
                        <>
                          Pick a plan before {formatPlanDate(planInfo.trialEndsAt)} to keep using
                          Clickforms without interruption.
                        </>
                      ) : (
                        <>
                          Your trial ended on {formatPlanDate(planInfo.trialEndsAt)}. Choose a plan
                          below to continue — sign-in is paused until then.
                        </>
                      )
                    ) : (
                      'This organisation is suspended. Contact us to reactivate it.'
                    )}
                  </p>
                </div>
                {planInfo.status === 'suspended' ? (
                  <Link href="/contact" className="button button--dark button--small">
                    Contact us
                  </Link>
                ) : null}
              </div>
            ) : null}

            <section className="org-card org-plan-card-summary">
              <div>
                <p className="org-plan-kicker">Current plan</p>
                <div className="org-card-name-row">
                  <h2 className="org-card-name org-card-name--lg">{PLAN_LABELS[planInfo.plan]}</h2>
                  <span className="org-status-pill" data-status={planInfo.status}>
                    {statusLabel}
                  </span>
                </div>
                {planInfo.status === 'active' && planInfo.renewsAt ? (
                  <p className="org-plan-meta">Renews {formatPlanDate(planInfo.renewsAt)}</p>
                ) : planInfo.status === 'trial' && planInfo.trialEndsAt ? (
                  <p className="org-plan-meta">
                    Trial through {formatPlanDate(planInfo.trialEndsAt)}
                  </p>
                ) : null}
              </div>
              {/* Deliberately a separate page (/forms/organisation/plan) rather than every
               * tier's price inline — see the note in change-plan-client.tsx. */}
              <Link
                href="/forms/organisation/plan"
                className="button button--small org-button-primary"
              >
                {planInfo.status === 'trial' ? 'Choose a plan' : 'Change plan'}
              </Link>
            </section>

            <Section title="Usage" description="This month against your current plan's limits.">
              {buildUsageBars(planInfo.plan, planInfo.usage).map((bar) => {
                const overLimit = bar.limit !== null && bar.used > bar.limit;
                return (
                  <Row
                    key={bar.label}
                    label={bar.label}
                    action={
                      <span
                        className={`org-usage-percent${overLimit ? ' org-usage-percent--over' : ''}`}
                      >
                        {bar.percent === null ? 'Unlimited' : `${bar.percent}%`}
                      </span>
                    }
                  >
                    <div className="org-usage">
                      <div className="org-usage-track">
                        <div
                          className={`org-usage-fill${overLimit ? ' org-usage-fill--over' : ''}`}
                          style={{ width: `${bar.percent ?? 100}%` }}
                          data-unlimited={bar.percent === null || undefined}
                        />
                      </div>
                      <span className="org-usage-value">{bar.formatted}</span>
                    </div>
                  </Row>
                );
              })}
            </Section>
          </div>
        ) : null}
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
    </div>
  );
}
