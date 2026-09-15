'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { TemplatePreviewModal } from '@/app/forms/templates/template-preview-modal';
import { useToast } from '@/components/toast';
import { getErrorMessage, readApiError } from '@/lib/error-message';

export interface GalleryTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  thumbnailUrl: string | null;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function TemplatesGalleryClient({ templates }: { templates: GalleryTemplate[] }) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [previewingTemplate, setPreviewingTemplate] = useState<GalleryTemplate | null>(null);
  const [naming, setNaming] = useState<{ templateId?: string; suggestedName: string } | null>(null);
  const [formName, setFormName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!naming) return;
    setFormName(naming.suggestedName);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isCreating) setNaming(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [naming, isCreating]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const template of templates) {
      const key = template.category?.trim() || 'Other';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [
      { key: 'all', label: 'All' },
      ...Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key]) => ({ key, label: key })),
    ];
  }, [templates]);

  const visibleTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((template) => {
      const templateCategory = template.category?.trim() || 'Other';
      if (category !== 'all' && templateCategory !== category) return false;
      if (!term) return true;
      return (
        template.name.toLowerCase().includes(term) ||
        (template.description ?? '').toLowerCase().includes(term)
      );
    });
  }, [templates, search, category]);

  const relatedTemplates = useMemo(() => {
    if (!previewingTemplate) return [];
    const currentCategory = previewingTemplate.category?.trim() || 'Other';
    return templates
      .filter(
        (template) =>
          template.id !== previewingTemplate.id &&
          (template.category?.trim() || 'Other') === currentCategory,
      )
      .slice(0, 6);
  }, [templates, previewingTemplate]);

  async function createForm(body: { name: string; templateId?: string }) {
    setIsCreating(true);
    try {
      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  function handleNameSubmit(event: FormEvent) {
    event.preventDefault();
    if (!naming || !formName.trim()) return;
    void createForm({ name: formName.trim(), templateId: naming.templateId });
  }

  return (
    <div className="templates-studio">
      <header className="templates-studio-header">
        <h1 className="templates-studio-title">Create a form</h1>
        <p className="templates-studio-lead">Start blank, or customize a template.</p>
        <label className="templates-studio-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search templates"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search templates"
          />
        </label>
        <div className="templates-studio-chips" role="tablist" aria-label="Filter by category">
          {categories.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`templates-studio-chip${category === entry.key ? ' templates-studio-chip--active' : ''}`}
              onClick={() => setCategory(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </header>

      {visibleTemplates.length === 0 && category !== 'all' ? (
        <p className="templates-studio-empty">No templates in this category.</p>
      ) : visibleTemplates.length === 0 && search.trim() ? (
        <p className="templates-studio-empty">No templates match that search.</p>
      ) : (
        <div className="templates-studio-grid">
          <button
            type="button"
            className="template-tile template-tile--blank"
            disabled={isCreating}
            onClick={() => setNaming({ suggestedName: '' })}
          >
            <span className="template-tile-art">
              <span className="template-tile-blank-mark">+</span>
              <span>Create blank</span>
            </span>
          </button>
          {visibleTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="template-tile"
              onClick={() => setPreviewingTemplate(template)}
            >
              <span className="template-tile-art">
                {template.thumbnailUrl ? (
                  // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize
                  <img src={template.thumbnailUrl} alt="" />
                ) : (
                  <span className="template-tile-fallback">{template.name}</span>
                )}
              </span>
              <span className="template-tile-name">{template.name}</span>
            </button>
          ))}
        </div>
      )}

      <TemplatePreviewModal
        open={previewingTemplate !== null}
        template={previewingTemplate}
        related={relatedTemplates}
        isCreating={isCreating}
        locked={naming !== null}
        onClose={() => !isCreating && naming === null && setPreviewingTemplate(null)}
        onUse={() => {
          if (!previewingTemplate) return;
          setNaming({
            templateId: previewingTemplate.id,
            suggestedName: previewingTemplate.name,
          });
        }}
        onSelectRelated={(template) => {
          if (naming) return;
          setPreviewingTemplate(template);
        }}
      />

      {naming ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape and Cancel are also wired up
        <div
          className="modal-overlay modal-overlay--stack"
          onMouseDown={() => !isCreating && setNaming(null)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="name-form-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title" id="name-form-modal-title">
                Name your form
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => !isCreating && setNaming(null)}
                aria-label="Close"
                disabled={isCreating}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleNameSubmit}>
              <label className="modal-name-field">
                <span>Form name</span>
                <input
                  className="text-input"
                  placeholder="e.g. Intake assessment"
                  value={formName}
                  // biome-ignore lint/a11y/noAutofocus: this is the only field before continuing into the builder
                  autoFocus
                  onChange={(event) => setFormName(event.target.value)}
                  disabled={isCreating}
                />
              </label>
              <div className="modal-footer">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => !isCreating && setNaming(null)}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button className="button" type="submit" disabled={isCreating || !formName.trim()}>
                  {isCreating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
