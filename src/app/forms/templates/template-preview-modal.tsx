'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GalleryTemplate } from '@/app/forms/templates/gallery-template';

interface TemplatePreviewModalProps {
  open: boolean;
  template: GalleryTemplate | null;
  related: GalleryTemplate[];
  catalog: GalleryTemplate[];
  isCreating: boolean;
  /** True while the name-your-form dialog is stacked on top — keep this preview in place
   * but don't let Escape / backdrop click dismiss it underneath. */
  locked?: boolean;
  onClose: () => void;
  onUse: () => void;
  onSelectRelated: (template: GalleryTemplate) => void;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CloneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="7" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M3.5 10.5V3.8A1.3 1.3 0 0 1 4.8 2.5h6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TemplatePreviewModal({
  open,
  template,
  related,
  catalog,
  isCreating,
  locked = false,
  onClose,
  onUse,
  onSelectRelated,
}: TemplatePreviewModalProps) {
  const [tab, setTab] = useState<'overview' | 'faq'>('overview');
  const [query, setQuery] = useState('');
  const [relatedOffset, setRelatedOffset] = useState(0);

  useEffect(() => {
    if (!open || locked) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isCreating) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, locked, isCreating, onClose]);

  const previewId = template?.id;
  // Reset tab/search whenever the visitor picks a different template (related
  // row, prev/next). previewId is the actual trigger; biome flags it because the
  // setters don't read the id.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is keyed on previewId
  useEffect(() => {
    setTab('overview');
    setQuery('');
    setRelatedOffset(0);
  }, [previewId]);

  const searchHits = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return catalog
      .filter(
        (item) =>
          item.id !== template?.id &&
          (item.name.toLowerCase().includes(term) ||
            (item.description ?? '').toLowerCase().includes(term)),
      )
      .slice(0, 6);
  }, [catalog, query, template?.id]);

  if (!open || !template) return null;

  const categories = [template.formType, template.category, template.industry].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  const iframeSrc = `/template-preview/${template.id}?embed=1`;
  const relatedWindow = related.slice(relatedOffset, relatedOffset + 4);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; Escape key and a Close button are also wired up
    <div
      className="template-detail-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isCreating && !locked) onClose();
      }}
    >
      <div
        className="template-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="template-detail-exit" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="template-detail-hero">
          <div className="template-detail-stage">
            <div className="template-detail-stage-card">
              <iframe
                key={template.id}
                src={iframeSrc}
                title={`Preview of ${template.name}`}
                className="template-detail-frame"
                tabIndex={-1}
              />
            </div>
          </div>

          <div className="template-detail-meta">
            <div className="template-detail-search">
              <SearchIcon />
              <input
                type="search"
                placeholder="Search in Form Templates"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search in form templates"
              />
              {searchHits.length > 0 ? (
                <ul className="template-detail-search-hits">
                  {searchHits.map((hit) => (
                    <li key={hit.id}>
                      <button type="button" onClick={() => onSelectRelated(hit)}>
                        {hit.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <h2 className="template-detail-title" id="template-detail-title">
              {template.name}
            </h2>
            {template.description ? (
              <p className="template-detail-copy">{template.description}</p>
            ) : (
              <p className="template-detail-copy">
                A ready-made form you can copy and customise for your organisation.
              </p>
            )}
            <button
              type="button"
              className="template-detail-cta"
              onClick={onUse}
              disabled={isCreating || locked}
            >
              {isCreating ? 'Creating…' : 'Use Template'}
            </button>
            {categories.length > 0 ? (
              <div className="template-detail-cats">
                <p className="template-detail-cats-label">Categories</p>
                <ul>
                  {categories.map((category) => (
                    <li key={category}>{category}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="template-detail-tabs">
          <div className="template-detail-tablist" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'overview'}
              className={`template-detail-tab${tab === 'overview' ? ' template-detail-tab--active' : ''}`}
              onClick={() => setTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'faq'}
              className={`template-detail-tab${tab === 'faq' ? ' template-detail-tab--active' : ''}`}
              onClick={() => setTab('faq')}
            >
              FAQ
            </button>
          </div>
          <button type="button" className="template-detail-more" onClick={onClose}>
            ↓ Show more templates
          </button>
        </div>

        {tab === 'overview' ? (
          <div className="template-detail-overview">
            <div className="template-detail-about">
              <h3>About this template</h3>
              <p>
                {template.description ||
                  `${template.name} is a ready-made form you can copy into your workspace, then customise fields, design, and logic to match how your team works.`}
              </p>
              {template.fieldCount > 0 ? (
                <>
                  <p>
                    This template has a total of {template.fieldCount} form field
                    {template.fieldCount === 1 ? '' : 's'}
                    {template.fieldLabels.length > 0 ? ', such as:' : '.'}
                  </p>
                  {template.fieldLabels.length > 0 ? (
                    <ul>
                      {template.fieldLabels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </div>
            <aside className="template-detail-facts">
              <h3>Details</h3>
              <p className="template-detail-fact">
                <CloneIcon />
                {template.fieldCount} field{template.fieldCount === 1 ? '' : 's'}
              </p>
              <h3>Created by</h3>
              <p className="template-detail-creator">{template.createdByName}</p>
            </aside>
          </div>
        ) : (
          <div className="template-detail-faq">
            <h3>How do I use this template?</h3>
            <p>
              Click Use Template, name your form, and you’ll land in the builder with every field
              already in place. Change anything — fields, design, and logic are all yours after the
              copy.
            </p>
            <h3>Can I add or remove fields?</h3>
            <p>
              Yes. The template is a starting point, not a lock-in. Add, remove, or rearrange fields
              the same way you would on a blank form.
            </p>
          </div>
        )}

        {related.length > 0 ? (
          <div className="template-detail-related">
            <div className="template-detail-related-head">
              <h3>Related templates</h3>
              <div className="template-detail-related-nav">
                <button
                  type="button"
                  aria-label="Previous related templates"
                  disabled={relatedOffset === 0}
                  onClick={() => setRelatedOffset((current) => Math.max(0, current - 1))}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next related templates"
                  disabled={relatedOffset + 4 >= related.length}
                  onClick={() => setRelatedOffset((current) => current + 1)}
                >
                  ›
                </button>
              </div>
            </div>
            <div className="template-detail-related-row">
              {relatedWindow.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="template-detail-related-card"
                  onClick={() => onSelectRelated(item)}
                  disabled={isCreating || locked}
                >
                  <span className="template-detail-related-art">
                    {item.thumbnailUrl ? (
                      // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize
                      <img src={item.thumbnailUrl} alt="" />
                    ) : (
                      <span>{item.name}</span>
                    )}
                  </span>
                  <span className="template-detail-related-name">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
