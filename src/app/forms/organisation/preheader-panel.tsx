'use client';

import dynamic from 'next/dynamic';
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { FieldColorPicker } from '@/app/forms/[id]/builder/field-color-picker';
import { PreheaderPreview } from '@/components/preheader-preview';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';
import {
  defaultPreheader,
  type OrgPreheader,
  PREHEADER_LAYOUT_LABEL,
  PREHEADER_LAYOUTS,
  PREHEADER_LOGO_SIZES,
  type PreheaderLayout,
  type PreheaderLogoSize,
} from '@/lib/org-preheader';
import { PanelHead } from './panel-head';

// Tiptap + lowlight are a large chunk; load the shared builder editor on demand.
const RichTextEditor = dynamic(
  () => import('@/app/forms/[id]/builder/rich-text-editor').then((mod) => mod.RichTextEditor),
  { ssr: false, loading: () => <div className="rich-text-editor-loading">Loading editor…</div> },
);

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
const SIZE_LABEL: Record<PreheaderLogoSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

interface PreheaderPanelProps {
  orgName: string;
  /** Workspace logo URL (fallback when no pre-header logo is uploaded). */
  orgLogoUrl: string | null;
  /** URL of the pre-header's own uploaded logo, if any. */
  initialCustomLogoUrl: string | null;
  initial: OrgPreheader | null;
}

/** Colour setting collapsed to a swatch row; the full picker opens in a popover on demand. */
function BackgroundField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="preheader-field-row preheader-color" ref={rootRef}>
      <span className="preheader-field-label">Background</span>
      <button
        type="button"
        className="preheader-color-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className="preheader-color-swatch"
          style={value ? { backgroundColor: value } : undefined}
          data-empty={value ? undefined : ''}
        />
        <span>{value ?? 'None'}</span>
      </button>
      {open ? (
        <div className="preheader-color-popover" role="dialog" aria-label="Background colour">
          <FieldColorPicker
            label="Background"
            value={value}
            defaultColor="#ffffff"
            canEdit
            onChange={onChange}
          />
          {value ? (
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Remove background
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({
  step,
  title,
  description,
  aside,
  children,
}: {
  step: number;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="preheader-section">
      <header className="preheader-section-head">
        <span className="preheader-section-step" aria-hidden="true">
          {step}
        </span>
        <div className="preheader-section-copy">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {aside}
      </header>
      <div className="preheader-section-body">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="preheader-field">
      <span className="preheader-field-label" id={`seg-${label}`}>
        {label}
      </span>
      <div className="preheader-segmented" role="radiogroup" aria-labelledby={`seg-${label}`}>
        {options.map((option) => (
          // biome-ignore lint/a11y/useSemanticElements: styled segmented control, radio semantics via role
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className="preheader-segmented-option"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PreheaderPanel({
  orgName,
  orgLogoUrl,
  initialCustomLogoUrl,
  initial,
}: PreheaderPanelProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<OrgPreheader>(initial ?? defaultPreheader(orgName));
  const [customLogoUrl, setCustomLogoUrl] = useState(initialCustomLogoUrl);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dirty = JSON.stringify(value) !== saved;
  const logoUrl = customLogoUrl ?? orgLogoUrl;

  function patch(next: Partial<OrgPreheader>) {
    setValue((current) => ({ ...current, ...next }));
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast.error(`Logo exceeds the ${MAX_LOGO_SIZE_BYTES / (1024 * 1024)}MB limit.`);
      return;
    }
    setIsUploading(true);
    try {
      const mimeType = file.type || 'application/octet-stream';
      const presignRes = await fetch('/api/organization/logo/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType, sizeBytes: file.size }),
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
        headers: { 'Content-Type': mimeType },
        body: file,
      });
      if (!putRes.ok) {
        toast.error('Upload to storage failed. Check S3 configuration and try again.');
        return;
      }
      // Shown immediately from the local file; the saved URL replaces it after Save.
      setCustomLogoUrl(URL.createObjectURL(file));
      patch({ logoStorageKey: storageKey, showLogo: true });
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch('/api/organization/preheader', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not save pre-header'));
        return;
      }
      const data = (await res.json()) as { logoUrl: string | null };
      if (value.logoStorageKey && data.logoUrl) setCustomLogoUrl(data.logoUrl);
      setSaved(JSON.stringify(value));
      toast.success('Pre-header saved');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="org-panel org-panel--wide">
      <PanelHead
        icon="layout"
        tone="violet"
        title="Form pre-header"
        description="Design the header offered at the top of forms created from a template. You choose to use it or skip it each time, and can edit it in the builder afterwards."
      />
      <div className="preheader-panel-grid">
        <div className="preheader-panel-fields">
          <Section step={1} title="Layout" description="Where the logo sits relative to your text.">
            <Segmented<PreheaderLayout>
              label="Arrangement"
              value={value.layout}
              options={PREHEADER_LAYOUTS.map((layout) => ({
                value: layout,
                label: PREHEADER_LAYOUT_LABEL[layout],
              }))}
              onChange={(layout) => patch({ layout })}
            />
          </Section>

          <Section
            step={2}
            title="Logo"
            description="Your organisation logo, or a different one just for this header."
            aside={
              <button
                type="button"
                role="switch"
                aria-checked={value.showLogo}
                aria-label="Show logo"
                className="settings-toggle"
                onClick={() => patch({ showLogo: !value.showLogo })}
              >
                <span className="settings-toggle-thumb" />
              </button>
            }
          >
            {value.showLogo ? (
              <>
                <div className="preheader-logo-card">
                  <div className="preheader-logo-thumb">
                    {logoUrl ? (
                      // biome-ignore lint/performance/noImgElement: presigned S3 URL or local object URL
                      <img src={logoUrl} alt="" />
                    ) : (
                      <span>No logo</span>
                    )}
                  </div>
                  <div className="preheader-logo-actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={LOGO_ACCEPT}
                      className="org-file-input"
                      onChange={(event) => void uploadLogo(event)}
                      disabled={isUploading}
                    />
                    <button
                      type="button"
                      className="button button--secondary button--small"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? 'Uploading…' : customLogoUrl ? 'Replace logo' : 'Upload logo'}
                    </button>
                    {customLogoUrl ? (
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        onClick={() => {
                          setCustomLogoUrl(null);
                          patch({ logoStorageKey: undefined });
                        }}
                      >
                        Use organisation logo
                      </button>
                    ) : (
                      <p className="preheader-panel-hint">
                        {orgLogoUrl
                          ? 'Using your organisation logo.'
                          : 'No organisation logo set. Upload one for this header.'}
                      </p>
                    )}
                  </div>
                </div>
                <Segmented<PreheaderLogoSize>
                  label="Size"
                  value={value.logoSize}
                  options={PREHEADER_LOGO_SIZES.map((size) => ({
                    value: size,
                    label: SIZE_LABEL[size],
                  }))}
                  onChange={(logoSize) => patch({ logoSize })}
                />
              </>
            ) : (
              <p className="preheader-panel-hint">The logo is hidden in this header.</p>
            )}
          </Section>

          <Section
            step={3}
            title="Content"
            description="Name, address, contact details, anything you want shown in the header."
          >
            <div className="preheader-editor">
              <RichTextEditor
                value={value.body}
                onChange={(body) => patch({ body })}
                disabled={isSaving}
                fields={{}}
                excludeFieldId="org-preheader"
                ariaLabel="Pre-header content"
              />
            </div>
          </Section>

          <Section step={4} title="Style" description="Optional finishing touches.">
            <BackgroundField
              value={value.backgroundColor}
              onChange={(backgroundColor) => patch({ backgroundColor })}
            />
            <div className="preheader-field-row">
              <span className="preheader-field-label">Divider line below</span>
              <button
                type="button"
                role="switch"
                aria-checked={value.showDivider}
                aria-label="Show divider line"
                className="settings-toggle"
                onClick={() => patch({ showDivider: !value.showDivider })}
              >
                <span className="settings-toggle-thumb" />
              </button>
            </div>
          </Section>

          <div className="preheader-panel-actions">
            <button
              type="button"
              className="button button--dark"
              disabled={isSaving || isUploading || !dirty}
              onClick={() => void handleSave()}
            >
              {isSaving ? 'Saving…' : 'Save pre-header'}
            </button>
            {dirty ? <span className="preheader-unsaved">Unsaved changes</span> : null}
          </div>
        </div>

        <div className="preheader-panel-preview">
          <p className="preheader-field-label">Live preview</p>
          <PreheaderPreview preheader={value} logoUrl={logoUrl} orgName={orgName} />
        </div>
      </div>
    </section>
  );
}
