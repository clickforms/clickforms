'use client';

import type { OrgPlan, OrgStatus } from '@prisma/client';
import Link from 'next/link';
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ImageCropEditor } from '@/app/forms/[id]/builder/image-crop-editor';
import { useToast } from '@/components/toast';
import {
  buildUsageBars,
  formatBytes,
  PLAN_FEATURE_PILLS,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_ORDER,
  type PlanUsage,
} from '@/lib/admin/plan-limits';
import { getErrorMessage, readApiError } from '@/lib/error-message';
import { isCroppableImage } from '@/lib/forms/crop-image';

/** Keep in sync with MAX_LOGO_SIZE_BYTES / the logo MIME allowlist in src/lib/s3.ts —
 * not imported from there because that module is `server-only` (mirrors the same
 * duplication already done for MAX_UPLOAD_SIZE_BYTES in src/app/forms/files/files-client.tsx). */
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

/** Display-only prices matching src/components/landing/landing-pricing.tsx — no
 * payment provider is wired, so these are orientation, not a charge. */
const PLAN_PRICE: Record<OrgPlan, string> = {
  standard: '$49',
  business: '$129',
  professional: '$219',
  enterprise: 'Custom',
};

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
  /** Absolute origin for this org's public subdomain, e.g. https://carecircle.clickforms.com.au */
  publicOrigin: string;
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

/** Which of the four usage bars would already be over `targetPlan`'s cap given current
 * usage — advisory only, shown as a warning before a self-service plan switch (see
 * handleChangePlan): the switch itself is never blocked by this, since an org that's
 * over-limit from an admin-assigned downgrade is already a normal, supported state
 * (see assertOrgActionsAllowed's siblings in plan-enforcement.ts, which only stop the
 * *next* create/invite/upload, not existing data). */
function computeOverLimitLabels(targetPlan: OrgPlan, usage: PlanUsage): string[] {
  const limits = PLAN_LIMITS[targetPlan];
  const labels: string[] = [];
  if (limits.maxForms !== null && usage.forms > limits.maxForms) labels.push('Forms');
  if (limits.maxUsers !== null && usage.users > limits.maxUsers) labels.push('Users');
  if (limits.maxStorageBytes !== null && usage.storageBytes > limits.maxStorageBytes) {
    labels.push('Storage');
  }
  if (
    limits.maxSubmissionsPerMonth !== null &&
    usage.submissionsThisMonth > limits.maxSubmissionsPerMonth
  ) {
    labels.push('Submissions this month');
  }
  return labels;
}

function orgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function planLimitLines(plan: OrgPlan): string[] {
  const limits = PLAN_LIMITS[plan];
  return [
    limits.maxForms === null ? 'Unlimited forms' : `${limits.maxForms} forms`,
    limits.maxUsers === null ? 'Unlimited users' : `${limits.maxUsers} users`,
    limits.maxStorageBytes === null
      ? 'Unlimited storage'
      : `${formatBytes(limits.maxStorageBytes)} storage`,
    limits.maxSubmissionsPerMonth === null
      ? 'Unlimited submissions'
      : `${limits.maxSubmissionsPerMonth.toLocaleString()} submissions / mo`,
  ];
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

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.2v3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="5.2" r="0.7" fill="currentColor" />
    </svg>
  );
}

function HelpTip({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <span className="org-help">
      <button type="button" className="org-help-button" aria-describedby={id} aria-label={label}>
        <InfoIcon />
      </button>
      <span id={id} role="tooltip" className="org-help-tooltip">
        {children}
      </span>
    </span>
  );
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

export function OrganisationDetailsClient({
  initialOrganization,
  plan,
  publicOrigin,
}: OrganisationDetailsClientProps) {
  const toast = useToast();
  // Defaults to Billing when there's something to act on (trial/suspended) so the
  // organisation's own admin lands straight on the thing that needs attention, rather
  // than General's identity fields they weren't looking for.
  const [activeTab, setActiveTab] = useState<'general' | 'billing'>(
    plan.status === 'active' ? 'general' : 'billing',
  );
  // Local copy of the plan prop — handleChangePlan below updates this in place (plan +
  // status, since picking a plan also graduates a trialing org to 'active') without a
  // full page reload. Usage counts aren't refetched since a plan switch never changes
  // them, only the caps they're checked against.
  const [planInfo, setPlanInfo] = useState(plan);
  const [selectedPlan, setSelectedPlan] = useState<OrgPlan>(plan.plan);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [planChangeError, setPlanChangeError] = useState<string | null>(null);
  const overLimitLabels = useMemo(
    () => computeOverLimitLabels(selectedPlan, planInfo.usage),
    [selectedPlan, planInfo.usage],
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

  const closeCropSession = useCallback(() => {
    setCropSession((prev) => {
      if (prev) URL.revokeObjectURL(prev.imageSrc);
      return null;
    });
  }, []);

  async function handleChangePlan() {
    setPlanChangeError(null);
    setIsChangingPlan(true);
    try {
      const res = await fetch('/api/organization/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      if (!res.ok) {
        setPlanChangeError(await readApiError(res, 'Could not change plan'));
        return;
      }
      const data: {
        plan: Pick<OrganizationPlanInfo, 'plan' | 'status' | 'trialEndsAt' | 'renewsAt'>;
      } = await res.json();
      setPlanInfo((prev) => ({ ...prev, ...data.plan }));
      setSelectedPlan(data.plan.plan);
      toast.success(`Switched to the ${PLAN_LABELS[data.plan.plan]} plan`);
    } catch {
      setPlanChangeError('Something went wrong. Please try again.');
    } finally {
      setIsChangingPlan(false);
    }
  }

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

  const trialDays = planInfo.trialEndsAt ? daysUntil(planInfo.trialEndsAt) : 0;

  return (
    <div className="org-settings">
      <header className="org-settings-header">
        <div>
          <p className="settings-page-kicker">Workspace</p>
          <h1 className="org-settings-title">Organisation</h1>
          <p className="org-settings-lead">
            Identity, contact details, and the plan this workspace is on.
          </p>
        </div>
        <div
          className="org-settings-tabs"
          role="tablist"
          aria-label="Organisation settings sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'general'}
            className={`org-settings-tab${activeTab === 'general' ? ' org-settings-tab--active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'billing'}
            className={`org-settings-tab${activeTab === 'billing' ? ' org-settings-tab--active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            Billing
            {planInfo.status !== 'active' ? (
              <span className="org-settings-tab-dot" aria-hidden="true" />
            ) : null}
          </button>
        </div>
      </header>

      {activeTab === 'general' ? (
        <form id="org-general-form" className="org-settings-stack" onSubmit={handleSubmit}>
          {error ? (
            <p className="form-error org-settings-error" role="alert">
              {error}
            </p>
          ) : null}

          <section className="org-panel org-identity">
            <input
              ref={logoInputRef}
              type="file"
              accept={LOGO_ACCEPT}
              className="org-file-input"
              onChange={(event) => void handleLogoFileChange(event)}
              disabled={isUploadingLogo || isRemovingLogo}
            />
            <button
              type="button"
              className="org-identity-logo"
              disabled={isUploadingLogo || isRemovingLogo}
              onClick={() => logoInputRef.current?.click()}
              aria-label={logoUrl ? 'Replace organisation logo' : 'Upload organisation logo'}
            >
              {logoUrl ? (
                // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize
                <img src={logoUrl} alt="" />
              ) : (
                <span className="org-identity-initials">{orgInitials(name || 'Organisation')}</span>
              )}
              <span className="org-identity-logo-overlay">
                {isUploadingLogo ? '…' : <CameraIcon />}
              </span>
            </button>
            <div className="org-identity-copy">
              <div className="org-identity-name-row">
                <h2 className="org-identity-name">{name.trim() || 'Untitled organisation'}</h2>
                <HelpTip id="org-help-logo" label="About the organisation logo">
                  PNG, JPEG, WebP, GIF, or SVG. Up to {MAX_LOGO_SIZE_BYTES / (1024 * 1024)}MB. Shown
                  in the workspace and on share-link previews.
                </HelpTip>
              </div>
              <div className="org-identity-url">
                <span className="org-identity-url-text" title={publicOrigin}>
                  {publicHost}
                </span>
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
                  className="button button--secondary button--small"
                  disabled={isUploadingLogo || isRemovingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {isUploadingLogo ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
                </button>
                {logoUrl ? (
                  <>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={isUploadingLogo || isRemovingLogo}
                      onClick={() => void handleEditExistingLogo()}
                    >
                      Crop
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={isUploadingLogo || isRemovingLogo}
                      onClick={() => void handleRemoveLogo()}
                    >
                      {isRemovingLogo ? 'Removing…' : 'Remove'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </section>

          <section className="org-panel">
            <header className="org-panel-head">
              <h2 className="org-panel-title">Profile</h2>
            </header>
            <div className="org-rows">
              <div className="org-row">
                <div className="org-row-copy">
                  <label htmlFor="org-name">Organisation name</label>
                </div>
                <div className="org-row-control">
                  <input
                    id="org-name"
                    className="text-input org-input"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div className="org-row">
                <div className="org-row-copy">
                  <label htmlFor="org-abn">ABN</label>
                </div>
                <div className="org-row-control">
                  <input
                    id="org-abn"
                    className="text-input org-input"
                    value={abn}
                    onChange={(event) => setAbn(event.target.value)}
                    placeholder="11 222 333 444"
                    inputMode="numeric"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div className="org-row">
                <div className="org-row-copy">
                  <span className="org-row-label">Public URL</span>
                </div>
                <div className="org-row-control">
                  <div className="org-readonly">
                    <span>{publicHost}</span>
                    <button
                      type="button"
                      className="org-icon-button"
                      onClick={() => void copyPublicHost()}
                      aria-label="Copy public URL"
                    >
                      <CopyIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="org-panel">
            <header className="org-panel-head">
              <h2 className="org-panel-title">Contact</h2>
            </header>
            <div className="org-rows">
              <div className="org-row">
                <div className="org-row-copy">
                  <label htmlFor="org-contact-name">Contact person</label>
                </div>
                <div className="org-row-control">
                  <input
                    id="org-contact-name"
                    className="text-input org-input"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div className="org-row">
                <div className="org-row-copy">
                  <label htmlFor="org-contact-email">Contact email</label>
                </div>
                <div className="org-row-control">
                  <input
                    id="org-contact-email"
                    className="text-input org-input"
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    placeholder="contact@yourorg.com"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div className="org-row">
                <div className="org-row-copy">
                  <label htmlFor="org-contact-phone">Contact phone</label>
                </div>
                <div className="org-row-control">
                  <input
                    id="org-contact-phone"
                    className="text-input org-input"
                    type="tel"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    placeholder="0400 000 000"
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="org-panel org-panel--wide">
            <header className="org-panel-head">
              <h2 className="org-panel-title">
                Notifications
                <HelpTip id="org-help-notifications" label="About notifications">
                  Organisation-wide default when someone submits a form. Individual forms can still
                  override this from their own Settings page.
                </HelpTip>
              </h2>
            </header>
            <div className="org-rows">
              <div className="org-row org-row--toggle">
                <div className="org-row-copy">
                  <span className="org-row-label org-label-with-help">
                    Email me new responses
                    <HelpTip id="org-help-notify-toggle" label="About response emails">
                      Sends a PDF copy of each submission to the address below.
                    </HelpTip>
                  </span>
                </div>
                <div className="org-row-control org-row-control--end">
                  <Toggle
                    checked={notificationsEnabled}
                    onChange={setNotificationsEnabled}
                    disabled={isSaving}
                    label="Response notification email"
                  />
                </div>
              </div>
              {notificationsEnabled ? (
                <div className="org-row">
                  <div className="org-row-copy">
                    <label htmlFor="org-notify-email">Notification email</label>
                  </div>
                  <div className="org-row-control">
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
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <div className={`org-savebar${isDirty ? ' org-savebar--visible' : ''}`}>
            <p>{isDirty ? 'You have unsaved changes' : 'All changes saved'}</p>
            <button type="submit" className="button button--dark" disabled={isSaving || !isDirty}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
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
                      : 'Trial ended'
                    : 'Organisation suspended'}
                </p>
                <p className="org-banner-body">
                  {planInfo.status === 'trial' && planInfo.trialEndsAt ? (
                    trialDays > 0 ? (
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

          <section className="org-panel org-plan-summary">
            <div>
              <p className="org-plan-kicker">Current plan</p>
              <div className="org-plan-summary-title-row">
                <h2 className="org-plan-name">{PLAN_LABELS[planInfo.plan]}</h2>
                <span className={`badge ${PLAN_STATUS_BADGE_CLASS[planInfo.status]}`}>
                  {planInfo.status === 'trial'
                    ? 'Trial'
                    : planInfo.status === 'suspended'
                      ? 'Suspended'
                      : 'Active'}
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
            <div className="org-plan-summary-actions">
              <Link href="/pricing" className="button button--secondary button--small">
                Compare plans
              </Link>
              <Link href="/contact" className="button button--ghost button--small">
                Contact us
              </Link>
            </div>
          </section>

          <section className="org-panel org-panel--wide">
            <header className="org-panel-head">
              <h2 className="org-panel-title">
                Usage
                <HelpTip id="org-help-usage" label="About usage">
                  This month against your current plan&apos;s limits.
                </HelpTip>
              </h2>
            </header>
            <div className="org-usage-grid">
              {buildUsageBars(planInfo.plan, planInfo.usage).map((bar) => {
                const overLimit = bar.limit !== null && bar.used > bar.limit;
                return (
                  <div
                    key={bar.label}
                    className={`org-usage-card${overLimit ? ' org-usage-card--over' : ''}`}
                  >
                    <div className="org-usage-card-head">
                      <span>{bar.label}</span>
                      <strong>{bar.percent === null ? 'Unlimited' : `${bar.percent}%`}</strong>
                    </div>
                    <p className="org-usage-card-value">{bar.formatted}</p>
                    <div className="org-usage-track">
                      <div
                        className={`org-usage-fill${overLimit ? ' org-usage-fill--over' : ''}`}
                        style={{ width: `${bar.percent ?? 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="org-panel org-panel--wide">
            <header className="org-panel-head">
              <h2 className="org-panel-title">
                Change plan
                <HelpTip id="org-help-change-plan" label="About changing plan">
                  Select a tier, then confirm. Existing data is never deleted.
                </HelpTip>
              </h2>
            </header>
            {planChangeError ? (
              <p className="form-error org-settings-error" role="alert">
                {planChangeError}
              </p>
            ) : null}
            <div className="org-plan-grid">
              {PLAN_ORDER.map((planOption) => {
                const current = planOption === planInfo.plan;
                const selected = planOption === selectedPlan;
                return (
                  <button
                    key={planOption}
                    type="button"
                    className={`org-plan-card${selected ? ' org-plan-card--selected' : ''}${current ? ' org-plan-card--current' : ''}`}
                    onClick={() => setSelectedPlan(planOption)}
                    disabled={isChangingPlan}
                    aria-pressed={selected}
                  >
                    <span className="org-plan-card-top">
                      <span className="org-plan-card-name">{PLAN_LABELS[planOption]}</span>
                      {current ? <span className="org-plan-card-badge">Current</span> : null}
                    </span>
                    <span className="org-plan-card-price">
                      {PLAN_PRICE[planOption]}
                      {PLAN_PRICE[planOption] !== 'Custom' ? (
                        <span className="org-plan-card-period"> / mo</span>
                      ) : null}
                    </span>
                    <ul className="org-plan-card-limits">
                      {planLimitLines(planOption).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <ul className="org-plan-card-features">
                      {PLAN_FEATURE_PILLS.map((feature) => {
                        const on = PLAN_LIMITS[planOption][feature.key];
                        return (
                          <li
                            key={feature.key}
                            className={
                              on ? 'org-plan-card-feature--on' : 'org-plan-card-feature--off'
                            }
                          >
                            {on ? <CheckIcon /> : null}
                            {feature.label}
                          </li>
                        );
                      })}
                    </ul>
                  </button>
                );
              })}
            </div>
            {selectedPlan !== planInfo.plan && overLimitLabels.length > 0 ? (
              <p className="org-plan-warning">
                Switching to {PLAN_LABELS[selectedPlan]} would put you over its limit on{' '}
                {overLimitLabels.join(', ')}. Existing data is safe — you just won&apos;t be able to
                add more there until you&apos;re back under the limit.
              </p>
            ) : null}
            <div className="org-plan-confirm">
              <button
                type="button"
                className="button button--dark"
                disabled={
                  isChangingPlan || (selectedPlan === planInfo.plan && planInfo.status !== 'trial')
                }
                onClick={() => void handleChangePlan()}
              >
                {isChangingPlan
                  ? 'Updating…'
                  : selectedPlan === planInfo.plan
                    ? 'Current plan'
                    : `Switch to ${PLAN_LABELS[selectedPlan]}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}

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
