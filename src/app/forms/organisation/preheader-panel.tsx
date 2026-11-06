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
import './preheader-designer.css';

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
const SIZE_BAR_PX: Record<PreheaderLogoSize, number> = { small: 10, medium: 16, large: 24 };

/** Quick background choices; anything else goes through the custom picker. */
const BACKGROUND_PRESETS: { value: string; label: string }[] = [
  { value: '#ffffff', label: 'White' },
  { value: '#f1f5f9', label: 'Soft grey' },
  { value: '#e9fdf1', label: 'Soft green' },
  { value: '#efecff', label: 'Soft violet' },
  { value: '#fef3e0', label: 'Soft amber' },
  { value: '#0f172a', label: 'Midnight' },
];

interface PreheaderPanelProps {
  orgName: string;
  /** Workspace logo URL (fallback when no pre-header logo is uploaded). */
  orgLogoUrl: string | null;
  /** URL of the pre-header's own uploaded logo, if any. */
  initialCustomLogoUrl: string | null;
  initial: OrgPreheader | null;
}

/** Miniature drawing of each arrangement so the choice is visual. */
function LayoutDiagram({ layout }: { layout: PreheaderLayout }) {
  const logo = <rect width="22" height="22" rx="5" className="ph-diagram-logo" />;
  if (layout === 'stacked') {
    return (
      <svg viewBox="0 0 120 56" aria-hidden="true">
        <g transform="translate(49 4)">{logo}</g>
        <rect x="30" y="32" width="60" height="5" rx="2.5" className="ph-diagram-line" />
        <rect x="40" y="42" width="40" height="5" rx="2.5" className="ph-diagram-line" />
      </svg>
    );
  }
  const logoLeft = layout === 'logo-left';
  return (
    <svg viewBox="0 0 120 56" aria-hidden="true">
      <g transform={`translate(${logoLeft ? 10 : 88} 17)`}>{logo}</g>
      <rect
        x={logoLeft ? 56 : 12}
        y="19"
        width="52"
        height="5"
        rx="2.5"
        className="ph-diagram-line"
      />
      <rect
        x={logoLeft ? 66 : 12}
        y="30"
        width="42"
        height="5"
        rx="2.5"
        className="ph-diagram-line"
      />
    </svg>
  );
}

function Block({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ph-block">
      <header className="ph-block-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="settings-toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

function BackgroundField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isPreset = value ? BACKGROUND_PRESETS.some((preset) => preset.value === value) : false;

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
    <div className="ph-bg" ref={rootRef}>
      <fieldset className="ph-swatches ph-reset" aria-label="Background colour">
        <button
          type="button"
          aria-pressed={!value}
          aria-label="No background"
          title="None"
          className="ph-swatch ph-swatch--none"
          onClick={() => onChange(undefined)}
        />
        {BACKGROUND_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            aria-pressed={value === preset.value}
            aria-label={preset.label}
            title={preset.label}
            className="ph-swatch"
            style={{ backgroundColor: preset.value }}
            onClick={() => onChange(preset.value)}
          />
        ))}
        <button
          type="button"
          className={`ph-swatch ph-swatch--custom${value && !isPreset ? ' ph-swatch--custom-active' : ''}`}
          style={value && !isPreset ? { backgroundColor: value } : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          title="Custom colour"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="ph-swatch-plus" aria-hidden="true">
            +
          </span>
          <span className="ph-sr">Custom colour</span>
        </button>
      </fieldset>
      {open ? (
        <div className="ph-popover" role="dialog" aria-label="Custom background colour">
          <FieldColorPicker
            label="Background"
            value={value}
            defaultColor="#ffffff"
            canEdit
            onChange={onChange}
          />
        </div>
      ) : null}
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
    <section className="org-panel org-panel--wide ph">
      <PanelHead
        icon="layout"
        tone="violet"
        title="Form pre-header"
        description="A header offered at the top of forms created from a template. You choose to use it or skip it each time, and can still edit it in the builder."
        aside={
          <div className="ph-head-actions">
            {dirty ? <span className="ph-unsaved">Unsaved changes</span> : null}
            <button
              type="button"
              className="button button--dark"
              disabled={isSaving || isUploading || !dirty}
              onClick={() => void handleSave()}
            >
              {isSaving ? 'Saving…' : 'Save pre-header'}
            </button>
          </div>
        }
      />

      <div className="ph-grid">
        <div className="ph-controls">
          <Block title="Layout" description="Where the logo sits relative to your text.">
            <fieldset className="ph-tiles ph-reset" aria-label="Layout">
              {PREHEADER_LAYOUTS.map((layout) => (
                <button
                  key={layout}
                  type="button"
                  aria-pressed={value.layout === layout}
                  className="ph-tile"
                  onClick={() => patch({ layout })}
                >
                  <LayoutDiagram layout={layout} />
                  <span>{PREHEADER_LAYOUT_LABEL[layout]}</span>
                </button>
              ))}
            </fieldset>
          </Block>

          <Block
            title="Logo"
            description="Your organisation logo, or a different one just for this header."
            aside={
              <Toggle
                checked={value.showLogo}
                onChange={(showLogo) => patch({ showLogo })}
                label="Show logo"
              />
            }
          >
            {value.showLogo ? (
              <>
                <div className="ph-logo">
                  <div className="ph-logo-thumb">
                    {logoUrl ? (
                      // biome-ignore lint/performance/noImgElement: presigned S3 URL or local object URL
                      <img src={logoUrl} alt="" />
                    ) : (
                      <span>No logo</span>
                    )}
                  </div>
                  <div className="ph-logo-copy">
                    <p className="ph-logo-name">
                      {customLogoUrl ? 'Custom logo' : 'Organisation logo'}
                      <span className="ph-chip">
                        {customLogoUrl ? 'This header only' : 'Default'}
                      </span>
                    </p>
                    <div className="ph-logo-actions">
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
                        {isUploading
                          ? 'Uploading…'
                          : customLogoUrl
                            ? 'Replace'
                            : 'Upload different logo'}
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
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="ph-field">
                  <span className="ph-label">Size</span>
                  <fieldset className="ph-segmented ph-reset" aria-label="Logo size">
                    {PREHEADER_LOGO_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        aria-pressed={value.logoSize === size}
                        className="ph-segmented-option"
                        onClick={() => patch({ logoSize: size })}
                      >
                        <span
                          className="ph-size-bar"
                          style={{ height: `${SIZE_BAR_PX[size]}px` }}
                          aria-hidden="true"
                        />
                        {SIZE_LABEL[size]}
                      </button>
                    ))}
                  </fieldset>
                </div>
              </>
            ) : (
              <p className="ph-muted">The logo is hidden in this header.</p>
            )}
          </Block>

          <Block
            title="Content"
            description="Name, address and contact details. Format it however you like."
          >
            <div className="ph-editor">
              <RichTextEditor
                value={value.body}
                onChange={(body) => patch({ body })}
                disabled={isSaving}
                fields={{}}
                excludeFieldId="org-preheader"
                ariaLabel="Pre-header content"
              />
            </div>
          </Block>

          <Block title="Appearance" description="Background colour and an optional divider line.">
            <div className="ph-field">
              <span className="ph-label">Background</span>
              <BackgroundField
                value={value.backgroundColor}
                onChange={(backgroundColor) => patch({ backgroundColor })}
              />
            </div>
            <div className="ph-row">
              <div>
                <span className="ph-label">Divider line</span>
                <p className="ph-muted">A thin rule between the header and the form.</p>
              </div>
              <Toggle
                checked={value.showDivider}
                onChange={(showDivider) => patch({ showDivider })}
                label="Show divider line"
              />
            </div>
          </Block>
        </div>

        <aside className="ph-preview">
          <div className="ph-preview-head">
            <h3>Live preview</h3>
            <p>How it appears at the top of a new form.</p>
          </div>
          <PreheaderPreview preheader={value} logoUrl={logoUrl} orgName={orgName} />
        </aside>
      </div>
    </section>
  );
}
