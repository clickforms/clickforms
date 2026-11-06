'use client';

import { type FormEvent, useState } from 'react';
import { PreheaderPreview } from '@/components/preheader-preview';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';
import type { OrgPreheader } from '@/lib/org-preheader';

interface PreheaderPanelProps {
  orgName: string;
  logoUrl: string | null;
  initial: OrgPreheader | null;
}

export function PreheaderPanel({ orgName, logoUrl, initial }: PreheaderPanelProps) {
  const toast = useToast();
  const [value, setValue] = useState<OrgPreheader>(
    initial ?? { showLogo: true, title: orgName, details: '' },
  );
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [isSaving, setIsSaving] = useState(false);
  const dirty = JSON.stringify(value) !== saved;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
      setSaved(JSON.stringify(value));
      toast.success('Pre-header saved');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="org-panel org-panel--wide" onSubmit={handleSubmit}>
      <header className="org-panel-head">
        <h2 className="org-panel-title">Form pre-header</h2>
      </header>
      <div className="preheader-panel-grid">
        <div className="preheader-panel-fields">
          <p className="preheader-panel-hint">
            Shown at the top of forms you create from a template. You choose to use it or skip it
            each time, and can edit it in the builder afterwards.
          </p>
          <div className="preheader-panel-toggle">
            <span>
              Show organisation logo
              {logoUrl ? '' : ' (upload a logo on the General tab first)'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={value.showLogo}
              aria-label="Show organisation logo"
              className="settings-toggle"
              disabled={!logoUrl}
              onClick={() => setValue({ ...value, showLogo: !value.showLogo })}
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>
          <label>
            <span>Headline</span>
            <input
              className="text-input"
              value={value.title}
              maxLength={120}
              placeholder="Organisation name"
              onChange={(event) => setValue({ ...value, title: event.target.value })}
            />
          </label>
          <label>
            <span>Details (one per line)</span>
            <textarea
              className="text-input"
              value={value.details}
              maxLength={600}
              placeholder={'ABN 12 345 678 901\n1 Example St, Sydney NSW\n1300 000 000'}
              onChange={(event) => setValue({ ...value, details: event.target.value })}
            />
          </label>
          <div className="preheader-panel-actions">
            <button type="submit" className="button button--dark" disabled={isSaving || !dirty}>
              {isSaving ? 'Saving…' : 'Save pre-header'}
            </button>
          </div>
        </div>
        <PreheaderPreview preheader={value} logoUrl={logoUrl} orgName={orgName} />
      </div>
    </form>
  );
}
