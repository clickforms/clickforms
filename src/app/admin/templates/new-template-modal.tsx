'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { TaxonomyField } from '@/app/admin/templates/taxonomy-field';
import { useToast } from '@/components/toast';
import { getErrorMessage, readApiError } from '@/lib/error-message';

interface NewTemplateModalProps {
  open: boolean;
  onClose: () => void;
  industryOptions: string[];
  categoryOptions: string[];
  formTypeOptions: string[];
}

/** Creates a template shell (empty schema, draft) then jumps straight into its builder —
 * mirrors create-form-modal.tsx's "name it, then build it" flow. Industry/category/
 * form type/description are optional here since they're also editable later from the
 * template's settings. */
export function NewTemplateModal({
  open,
  onClose,
  industryOptions,
  categoryOptions,
  formTypeOptions,
}: NewTemplateModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [category, setCategory] = useState('');
  const [formType, setFormType] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setIndustry('');
    setCategory('');
    setFormType('');
    setDescription('');
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isCreating) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isCreating, onClose]);

  if (!open) return null;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/form-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || undefined,
          category: category.trim() || undefined,
          formType: formType.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to create template'));
      }
      const { template } = await response.json();
      router.push(`/admin/templates/${template.id}/builder`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create template'));
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
        aria-labelledby="new-template-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="new-template-modal-title">
            New template
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
          <label className="modal-name-field">
            <span>Template name</span>
            <input
              className="text-input"
              placeholder="e.g. Incident report"
              value={name}
              // biome-ignore lint/a11y/noAutofocus: this is the only field a person needs to fill before continuing into the builder
              autoFocus
              onChange={(event) => setName(event.target.value)}
              disabled={isCreating}
            />
          </label>
          <TaxonomyField
            className="modal-name-field"
            label="Industry (optional)"
            placeholder="e.g. Healthcare"
            value={industry}
            onChange={setIndustry}
            options={industryOptions}
            disabled={isCreating}
          />
          <TaxonomyField
            className="modal-name-field"
            label="Category (optional)"
            placeholder="e.g. NDIS, Childcare"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            disabled={isCreating}
          />
          <TaxonomyField
            className="modal-name-field"
            label="Form type (optional)"
            placeholder="e.g. Incident & safety"
            value={formType}
            onChange={setFormType}
            options={formTypeOptions}
            disabled={isCreating}
          />
          <label className="modal-name-field">
            <span>Description (optional)</span>
            <input
              className="text-input"
              placeholder="Shown to organisations browsing the template gallery"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
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
            <button className="button" type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? 'Creating…' : 'Create & continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
