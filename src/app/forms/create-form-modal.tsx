'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { getErrorMessage, readApiError } from '@/lib/error-message';
import { FORM_TEMPLATES, type FormTemplateId } from '@/lib/forms/templates';

type CreateMethod = 'blank' | FormTemplateId;

function BlankFormIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="4" y="2.5" width="14" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <line
        x1="7.5"
        y1="7"
        x2="14.5"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="7.5"
        y1="10.5"
        x2="14.5"
        y2="10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="7.5"
        y1="14"
        x2="11.5"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
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

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 14.5V4.5M11 4.5L7 8.5M11 4.5l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 13.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface CreateFormModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateFormModal({ open, onClose }: CreateFormModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [newFormName, setNewFormName] = useState('');
  const [method, setMethod] = useState<CreateMethod>('blank');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewFormName('');
    setMethod('blank');
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isCreating) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isCreating, onClose]);

  if (!open) return null;

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newFormName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFormName.trim(),
          ...(method !== 'blank' ? { templateId: method } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to create form'));
      }
      const { form } = await response.json();
      router.push(`/forms/${form.id}/builder`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create form'));
      setIsCreating(false);
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
    <div className="modal-overlay" onMouseDown={() => !isCreating && onClose()}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-form-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="create-form-modal-title">
            Create form
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={isCreating}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleCreate}>
          <p className="modal-section-label">Select a starting method</p>
          <div className="method-cards">
            <button
              type="button"
              className={`method-card ${method === 'blank' ? 'method-card--selected' : ''}`}
              onClick={() => setMethod('blank')}
              disabled={isCreating}
            >
              <span className="method-card-icon">
                <BlankFormIcon />
              </span>
              <span className="method-card-title">Blank form</span>
              <span className="method-card-desc">
                Start from an empty form and add your own fields.
              </span>
            </button>
            {Object.values(FORM_TEMPLATES).map((template) => (
              <button
                key={template.id}
                type="button"
                className={`method-card ${method === template.id ? 'method-card--selected' : ''}`}
                onClick={() => {
                  setMethod(template.id);
                  if (!newFormName.trim()) {
                    setNewFormName('A2A - Incident Report Form');
                  }
                }}
                disabled={isCreating}
              >
                <span className="method-card-icon">
                  <TemplateIcon />
                </span>
                <span className="method-card-title">{template.name}</span>
                <span className="method-card-desc">{template.description}</span>
              </button>
            ))}
            <div className="method-card method-card--disabled" aria-disabled="true">
              <span className="method-card-badge">Coming soon</span>
              <span className="method-card-icon">
                <UploadIcon />
              </span>
              <span className="method-card-title">Send existing form</span>
              <span className="method-card-desc">Upload a PDF or Word form to convert.</span>
            </div>
          </div>

          <label className="modal-name-field">
            <span>Form name</span>
            <input
              className="text-input"
              placeholder="e.g. Intake assessment"
              value={newFormName}
              // biome-ignore lint/a11y/noAutofocus: this is the only field in a just-opened creation modal — focusing it is the expected behavior
              autoFocus
              onChange={(event) => setNewFormName(event.target.value)}
              disabled={isCreating}
            />
          </label>

          <div className="modal-footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button className="button" type="submit" disabled={isCreating || !newFormName.trim()}>
              {isCreating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
