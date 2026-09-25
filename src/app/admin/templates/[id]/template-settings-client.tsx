'use client';

import type { TemplateStatus } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import { TaxonomyField } from '@/app/admin/templates/taxonomy-field';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';

/** Keep in sync with the template thumbnail allowlist in src/lib/s3.ts
 * (assertTemplateThumbnailUploadAllowed) — not imported directly since that module is
 * `server-only` (same duplication already done for the org logo in
 * src/app/forms/organisation/organisation-details-client.tsx). */
const MAX_THUMBNAIL_SIZE_BYTES = 5 * 1024 * 1024;
const THUMBNAIL_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

export interface TemplateDetail {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  category: string | null;
  formType: string | null;
  status: TemplateStatus;
  thumbnailUrl: string | null;
}

const STATUS_LABELS: Record<TemplateStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const STATUS_HINTS: Record<TemplateStatus, string> = {
  draft: 'Only Clickforms Admin can see this. Organisations cannot copy it yet.',
  published: 'Visible in every organisation’s template gallery.',
  archived: 'Hidden from organisations. Keep it for later without deleting.',
};

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3.5 5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlaceholderThumbIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="3" width="8" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect
        x="11.5"
        y="3"
        width="8"
        height="4.5"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="11.5"
        y="9.5"
        width="8"
        height="7.5"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect x="2.5" y="12" width="8" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function TemplateSettingsClient({
  initialTemplate,
  industryOptions,
  categoryOptions,
  formTypeOptions,
}: {
  initialTemplate: TemplateDetail;
  industryOptions: string[];
  categoryOptions: string[];
  formTypeOptions: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initialTemplate.name);
  const [industry, setIndustry] = useState(initialTemplate.industry ?? '');
  const [category, setCategory] = useState(initialTemplate.category ?? '');
  const [formType, setFormType] = useState(initialTemplate.formType ?? '');
  const [description, setDescription] = useState(initialTemplate.description ?? '');
  const [status, setStatus] = useState(initialTemplate.status);
  const [thumbnailUrl, setThumbnailUrl] = useState(initialTemplate.thumbnailUrl);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isRemovingThumbnail, setIsRemovingThumbnail] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isDirty = useMemo(() => {
    return (
      name.trim() !== initialTemplate.name ||
      industry.trim() !== (initialTemplate.industry ?? '') ||
      category.trim() !== (initialTemplate.category ?? '') ||
      formType.trim() !== (initialTemplate.formType ?? '') ||
      description.trim() !== (initialTemplate.description ?? '') ||
      status !== initialTemplate.status
    );
  }, [name, industry, category, formType, description, status, initialTemplate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/form-templates/${initialTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          industry: industry.trim(),
          category: category.trim(),
          formType: formType.trim(),
          description: description.trim(),
          status,
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res, 'Could not save template'));
        return;
      }
      toast.success('Template saved');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadThumbnail(file: File) {
    if (file.size > MAX_THUMBNAIL_SIZE_BYTES) {
      toast.error(`Thumbnail exceeds the ${MAX_THUMBNAIL_SIZE_BYTES / (1024 * 1024)}MB limit.`);
      return;
    }

    setIsUploadingThumbnail(true);
    try {
      const presignRes = await fetch(
        `/api/admin/form-templates/${initialTemplate.id}/thumbnail/presign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        },
      );
      if (!presignRes.ok) {
        toast.error(await readApiError(presignRes, 'Could not start thumbnail upload'));
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

      const confirmRes = await fetch(
        `/api/admin/form-templates/${initialTemplate.id}/thumbnail/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storageKey,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        },
      );
      if (!confirmRes.ok) {
        toast.error(await readApiError(confirmRes, 'Could not save uploaded thumbnail'));
        return;
      }

      const { thumbnailUrl: newThumbnailUrl } = (await confirmRes.json()) as {
        thumbnailUrl: string | null;
      };
      setThumbnailUrl(newThumbnailUrl);
      toast.success('Thumbnail updated');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsUploadingThumbnail(false);
    }
  }

  function handleThumbnailFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void uploadThumbnail(file);
  }

  async function handleRemoveThumbnail() {
    setIsRemovingThumbnail(true);
    try {
      const res = await fetch(`/api/admin/form-templates/${initialTemplate.id}/thumbnail`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not remove thumbnail'));
        return;
      }
      setThumbnailUrl(null);
      toast.success('Thumbnail removed');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsRemovingThumbnail(false);
    }
  }

  async function handleDeleteConfirm() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/form-templates/${initialTemplate.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Failed to delete template'));
        return;
      }
      toast.success('Template deleted');
      router.push('/admin/templates');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  const galleryName = name.trim() || 'Untitled template';
  const galleryFacets = [industry.trim(), category.trim(), formType.trim()].filter(Boolean);

  return (
    <div className="admin-template">
      <Link href="/admin/templates" className="admin-org-back">
        <ChevronIcon /> Templates
      </Link>

      <header className="admin-org-header">
        <div>
          <div className="admin-org-title-row">
            <h1 className="admin-org-title">{initialTemplate.name}</h1>
            <span className={`admin-template-status-chip admin-template-status-chip--${status}`}>
              {STATUS_LABELS[status]}
            </span>
          </div>
          <p className="admin-org-meta">{STATUS_HINTS[status]}</p>
        </div>
        <Link
          href={`/admin/templates/${initialTemplate.id}/builder`}
          className="button button--dark"
        >
          Open builder
        </Link>
      </header>

      <div className="admin-template-layout">
        <section className="admin-org-panel admin-template-preview">
          <div className="admin-org-panel-header">
            <div>
              <h2 className="admin-org-panel-title">Gallery card</h2>
              <p className="admin-org-panel-copy">How organisations see this template.</p>
            </div>
          </div>
          <div className="admin-template-preview-body">
            <div className="template-gallery-card admin-template-preview-card">
              <div className="template-gallery-card-thumb">
                {thumbnailUrl ? (
                  // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize
                  <img src={thumbnailUrl} alt="" />
                ) : (
                  <PlaceholderThumbIcon />
                )}
              </div>
              <div className="template-gallery-card-body">
                <p className="template-gallery-card-title">{galleryName}</p>
                {galleryFacets.length > 0 ? (
                  <span className="template-gallery-card-category">
                    {galleryFacets.join(' · ')}
                  </span>
                ) : (
                  <span className="template-gallery-card-category">Uncategorised</span>
                )}
              </div>
            </div>
            <div className="admin-template-thumb-actions">
              <label className="button button--dark">
                <input
                  type="file"
                  accept={THUMBNAIL_ACCEPT}
                  className="organisation-logo-file-input"
                  onChange={handleThumbnailFileChange}
                  disabled={isUploadingThumbnail || isRemovingThumbnail}
                />
                {isUploadingThumbnail
                  ? 'Uploading…'
                  : thumbnailUrl
                    ? 'Replace image'
                    : 'Upload image'}
              </label>
              {thumbnailUrl ? (
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={isUploadingThumbnail || isRemovingThumbnail}
                  onClick={() => void handleRemoveThumbnail()}
                >
                  {isRemovingThumbnail ? 'Removing…' : 'Remove'}
                </button>
              ) : null}
              <p className="admin-template-thumb-hint">PNG, JPEG, WebP or GIF · up to 5MB</p>
            </div>
          </div>
        </section>

        <section className="admin-org-panel">
          <div className="admin-org-panel-header">
            <div>
              <h2 className="admin-org-panel-title">Details</h2>
              <p className="admin-org-panel-copy">Name, category, and who can use it.</p>
            </div>
          </div>
          <form className="admin-org-form" onSubmit={handleSubmit}>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="admin-template-fields">
              <label className="admin-org-field">
                <span>Name</span>
                <input
                  className="text-input"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isSaving}
                />
              </label>
              <TaxonomyField
                label="Industry"
                placeholder="e.g. Healthcare"
                value={industry}
                onChange={setIndustry}
                options={industryOptions}
                disabled={isSaving}
              />
              <TaxonomyField
                label="Category"
                placeholder="e.g. NDIS, Childcare"
                value={category}
                onChange={setCategory}
                options={categoryOptions}
                disabled={isSaving}
              />
              <TaxonomyField
                label="Form type"
                placeholder="e.g. Incident & safety"
                value={formType}
                onChange={setFormType}
                options={formTypeOptions}
                disabled={isSaving}
              />
              <label className="admin-org-field admin-template-field-wide">
                <span>Description</span>
                <textarea
                  className="text-input admin-template-textarea"
                  rows={3}
                  placeholder="Optional — shown when browsing the gallery"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isSaving}
                />
              </label>
              <fieldset className="admin-org-field admin-template-field-wide">
                <legend>Status</legend>
                <div className="admin-template-status-options">
                  {(Object.keys(STATUS_LABELS) as TemplateStatus[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`admin-template-status-option${
                        status === option ? ' admin-template-status-option--active' : ''
                      }`}
                      onClick={() => setStatus(option)}
                      disabled={isSaving}
                    >
                      {STATUS_LABELS[option]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="admin-org-form-actions">
              <button type="submit" className="button button--dark" disabled={isSaving || !isDirty}>
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="admin-org-danger">
        <div>
          <h2 className="admin-org-panel-title">Delete template</h2>
          <p className="admin-org-panel-copy">
            Removes it from the gallery. Forms already created from it are not affected.
          </p>
        </div>
        <button
          type="button"
          className="button button--ghost-danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isSaving}
        >
          Delete template
        </button>
      </section>

      {showDeleteConfirm ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
        <div
          className="modal-overlay"
          onMouseDown={() => !isDeleting && setShowDeleteConfirm(false)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-template-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title" id="delete-template-title">
                Delete "{initialTemplate.name}"?
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowDeleteConfirm(false)}
                aria-label="Close"
                disabled={isDeleting}
              >
                ×
              </button>
            </div>
            <p className="modal-body-text">
              This removes it from the template gallery. Forms organisations already created from it
              are never affected — this only deletes the template itself.
            </p>
            <div className="modal-footer">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete template'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
