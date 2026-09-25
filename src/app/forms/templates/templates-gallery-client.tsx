'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { GalleryTemplate } from '@/app/forms/templates/gallery-template';
import { TemplatePreviewModal } from '@/app/forms/templates/template-preview-modal';
import { DropdownMenu } from '@/components/dropdown-menu';
import { useToast } from '@/components/toast';
import { getErrorMessage, readApiError } from '@/lib/error-message';
import type { LayoutStyle } from '@/lib/forms/schema';

export type { GalleryTemplate };

type SortOption = 'popular' | 'newest' | 'az';
type LayoutFilter = 'all' | LayoutStyle;

const UNCATEGORISED = 'Uncategorised';
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'az', label: 'A–Z' },
];
const LAYOUT_OPTIONS: { value: LayoutFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'default', label: 'Classic' },
  { value: 'table', label: 'Table' },
];

function facetValue(
  template: GalleryTemplate,
  facet: 'industry' | 'category' | 'formType',
): string {
  return template[facet]?.trim() || UNCATEGORISED;
}

/** How closely `template` matches `reference` for the preview modal's related row —
 * form type is the most specific facet so it's weighted highest, industry the broadest. */
function relatedScore(template: GalleryTemplate, reference: GalleryTemplate): number {
  let score = 0;
  if (
    reference.formType &&
    facetValue(template, 'formType') === facetValue(reference, 'formType')
  ) {
    score += 4;
  }
  if (
    reference.category &&
    facetValue(template, 'category') === facetValue(reference, 'category')
  ) {
    score += 2;
  }
  if (
    reference.industry &&
    facetValue(template, 'industry') === facetValue(reference, 'industry')
  ) {
    score += 1;
  }
  return score;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3.5 5.5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TinyChevron({ open }: { open?: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`template-gallery-chevron${open ? ' template-gallery-chevron--open' : ''}`}
    >
      <path
        d="M3 4.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PreviewEyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M1.7 9s2.4-4.2 7.3-4.2S16.3 9 16.3 9s-2.4 4.2-7.3 4.2S1.7 9 1.7 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="2.15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Live scaled form in the card window. CSS :hover on the article keeps the form
 * panning for as long as the pointer is anywhere on the card. */
function TemplateBrowseCard({
  template,
  isCreating,
  onPreview,
  onUse,
}: {
  template: GalleryTemplate;
  isCreating: boolean;
  onPreview: () => void;
  onUse: () => void;
}) {
  return (
    <article className="template-browse-card">
      <div className="template-browse-card-art">
        <span className="template-browse-card-viewport">
          <iframe
            className="template-browse-card-frame"
            src={`/template-preview/${template.id}?embed=1&card=1`}
            title={`Form preview of ${template.name}`}
            tabIndex={-1}
            loading="lazy"
            aria-hidden="true"
          />
        </span>
        <button
          type="button"
          className="template-browse-card-hit"
          onClick={onPreview}
          aria-label={`Preview ${template.name}`}
        >
          <span className="template-browse-card-preview-btn">
            <PreviewEyeIcon />
            Preview
          </span>
        </button>
      </div>
      <h2 className="template-browse-card-title">{template.name}</h2>
      <button
        type="button"
        className="template-browse-card-cta"
        disabled={isCreating}
        onClick={onUse}
      >
        Use Template
      </button>
    </article>
  );
}

function FacetSelect({
  label,
  valueLabel,
  options,
  onSelect,
}: {
  label: string;
  valueLabel: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="template-gallery-select">
      <span className="template-gallery-select-label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="template-gallery-select-value"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {valueLabel}
        <TinyChevron />
      </button>
      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        triggerRef={triggerRef as RefObject<HTMLButtonElement | null>}
        align="end"
        panelClassName="actions-menu-panel template-gallery-select-panel"
      >
        {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern */}
        <ul role="menu">
          {options.map((option) => (
            <li role="none" key={option.value}>
              <button
                type="button"
                role="menuitem"
                className={`actions-menu-item${option.label === valueLabel ? ' actions-menu-item--success' : ''}`}
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </DropdownMenu>
    </div>
  );
}

export function TemplatesGalleryClient({ templates }: { templates: GalleryTemplate[] }) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [layoutFilter, setLayoutFilter] = useState<LayoutFilter>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedFormType, setSelectedFormType] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [typesOpen, setTypesOpen] = useState(true);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
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

  const term = search.trim().toLowerCase();
  function matchesSearch(template: GalleryTemplate): boolean {
    if (!term) return true;
    return (
      template.name.toLowerCase().includes(term) ||
      (template.description ?? '').toLowerCase().includes(term) ||
      facetValue(template, 'industry').toLowerCase().includes(term) ||
      facetValue(template, 'category').toLowerCase().includes(term) ||
      facetValue(template, 'formType').toLowerCase().includes(term)
    );
  }

  function matchesLayout(template: GalleryTemplate): boolean {
    return layoutFilter === 'all' || template.layoutStyle === layoutFilter;
  }

  function matchesIndustry(template: GalleryTemplate): boolean {
    return !selectedIndustry || facetValue(template, 'industry') === selectedIndustry;
  }

  function matchesType(template: GalleryTemplate): boolean {
    if (!selectedFormType) return true;
    if (facetValue(template, 'formType') !== selectedFormType) return false;
    if (!selectedCategory) return true;
    return facetValue(template, 'category') === selectedCategory;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: matchesSearch/matchesLayout/matchesType close over search + layout + type each render
  const industryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const template of templates) {
      if (!matchesSearch(template) || !matchesLayout(template) || !matchesType(template)) continue;
      const value = facetValue(template, 'industry');
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [templates, term, layoutFilter, selectedFormType, selectedCategory]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: matchesSearch/matchesLayout/matchesIndustry close over search + layout + industry each render
  const typeTree = useMemo(() => {
    const groups = new Map<string, { count: number; categories: Map<string, number> }>();
    for (const template of templates) {
      if (!matchesSearch(template) || !matchesLayout(template) || !matchesIndustry(template)) {
        continue;
      }
      const type = facetValue(template, 'formType');
      const category = facetValue(template, 'category');
      const group = groups.get(type) ?? { count: 0, categories: new Map() };
      group.count += 1;
      group.categories.set(category, (group.categories.get(category) ?? 0) + 1);
      groups.set(type, group);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([formType, group]) => ({
        formType,
        count: group.count,
        categories: Array.from(group.categories.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([value, count]) => ({ value, count })),
      }));
  }, [templates, term, layoutFilter, selectedIndustry]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: matches* close over the filter primitives listed below
  const visibleTemplates = useMemo(() => {
    const filtered = templates.filter(
      (template) =>
        matchesSearch(template) &&
        matchesLayout(template) &&
        matchesIndustry(template) &&
        matchesType(template),
    );
    return [...filtered].sort((a, b) => {
      if (sortBy === 'az') return a.name.localeCompare(b.name);
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  }, [templates, term, layoutFilter, selectedIndustry, selectedFormType, selectedCategory, sortBy]);

  const relatedTemplates = useMemo(() => {
    const current = previewingTemplate;
    if (!current) return [];
    return templates
      .filter((template) => template.id !== current.id)
      .map((template) => ({ template, score: relatedScore(template, current) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((entry) => entry.template);
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

  function goBack() {
    router.push('/forms');
  }

  function selectFormType(formType: string) {
    if (selectedFormType === formType && !selectedCategory) {
      setSelectedFormType(null);
      setSelectedCategory(null);
      return;
    }
    setSelectedFormType(formType);
    setSelectedCategory(null);
  }

  function selectCategory(formType: string, category: string) {
    if (selectedFormType === formType && selectedCategory === category) {
      setSelectedFormType(formType);
      setSelectedCategory(null);
      return;
    }
    setSelectedFormType(formType);
    setSelectedCategory(category);
  }

  function toggleTypeExpanded(formType: string) {
    setExpandedTypes((current) => {
      const next = new Set(current);
      if (next.has(formType)) next.delete(formType);
      else next.add(formType);
      return next;
    });
  }

  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? 'Popular';
  const layoutLabel =
    LAYOUT_OPTIONS.find((option) => option.value === layoutFilter)?.label ?? 'All';
  const industryLabel = selectedIndustry ?? 'All';

  return (
    <div className="template-gallery-page">
      <button type="button" className="template-gallery-back" onClick={goBack}>
        <BackIcon />
        Back
      </button>
      <button type="button" className="template-gallery-close" onClick={goBack} aria-label="Close">
        <CloseIcon />
      </button>

      <header className="template-gallery-header">
        <h1 className="template-gallery-title">Choose a template</h1>
        <p className="template-gallery-lead">
          Explore ready-made templates to create a form in minutes or{' '}
          <button
            type="button"
            className="template-gallery-scratch"
            disabled={isCreating}
            onClick={() => setNaming({ suggestedName: '' })}
          >
            create form from scratch
          </button>
        </p>
      </header>

      <div className="template-gallery-shell">
        <aside className="template-gallery-sidebar">
          <FacetSelect
            label="Sort by"
            valueLabel={sortLabel}
            options={SORT_OPTIONS}
            onSelect={(value) => setSortBy(value as SortOption)}
          />
          <FacetSelect
            label="Form layout"
            valueLabel={layoutLabel}
            options={LAYOUT_OPTIONS}
            onSelect={(value) => setLayoutFilter(value as LayoutFilter)}
          />
          <FacetSelect
            label="Industry"
            valueLabel={industryLabel}
            options={[
              { value: '', label: 'All' },
              ...industryOptions.map((option) => ({ value: option.value, label: option.value })),
            ]}
            onSelect={(value) => setSelectedIndustry(value || null)}
          />

          <div className="template-gallery-types">
            <button
              type="button"
              className="template-gallery-types-header"
              onClick={() => setTypesOpen((current) => !current)}
              aria-expanded={typesOpen}
            >
              <span>Types</span>
              <TinyChevron open={typesOpen} />
            </button>
            {typesOpen ? (
              <ul className="template-gallery-types-list">
                {typeTree.map((group) => {
                  const expandable = group.categories.some(
                    (category) => category.value !== UNCATEGORISED,
                  );
                  const expanded = expandedTypes.has(group.formType);
                  const typeActive =
                    selectedFormType === group.formType && selectedCategory === null;
                  return (
                    <li key={group.formType}>
                      <div
                        className={`template-gallery-type-row${typeActive ? ' template-gallery-type-row--active' : ''}`}
                      >
                        <button
                          type="button"
                          className="template-gallery-type-name"
                          onClick={() => selectFormType(group.formType)}
                        >
                          {group.formType}
                        </button>
                        {expandable ? (
                          <button
                            type="button"
                            className="template-gallery-type-expand"
                            aria-label={expanded ? 'Collapse' : 'Expand'}
                            aria-expanded={expanded}
                            onClick={() => toggleTypeExpanded(group.formType)}
                          >
                            <TinyChevron open={expanded} />
                          </button>
                        ) : (
                          <span className="template-gallery-type-expand" />
                        )}
                        <span className="template-gallery-type-count">{group.count}</span>
                      </div>
                      {expandable && expanded ? (
                        <ul className="template-gallery-type-children">
                          {group.categories.map((category) => {
                            const childActive =
                              selectedFormType === group.formType &&
                              selectedCategory === category.value;
                            return (
                              <li key={category.value}>
                                <button
                                  type="button"
                                  className={`template-gallery-type-child${childActive ? ' template-gallery-type-child--active' : ''}`}
                                  onClick={() => selectCategory(group.formType, category.value)}
                                >
                                  <span>{category.value}</span>
                                  <span className="template-gallery-type-count">
                                    {category.count}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </aside>

        <div className="template-gallery-main">
          <form className="template-gallery-search" onSubmit={(event) => event.preventDefault()}>
            <input
              type="search"
              placeholder="Search in all templates"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search in all templates"
            />
            <button type="submit" className="template-gallery-search-btn" aria-label="Search">
              <SearchIcon />
            </button>
          </form>

          <div className="template-gallery-grid">
            <button
              type="button"
              className="template-browse-card template-browse-card--scratch"
              disabled={isCreating}
              onClick={() => setNaming({ suggestedName: '' })}
            >
              <span className="template-browse-card-scratch-art" aria-hidden="true">
                <span className="template-browse-card-scratch-plus">+</span>
              </span>
              <span className="template-browse-card-title">Start from scratch</span>
              <span className="template-browse-card-scratch-copy">
                A blank slate is all you need
              </span>
            </button>
            {visibleTemplates.map((template) => (
              <TemplateBrowseCard
                key={template.id}
                template={template}
                isCreating={isCreating}
                onPreview={() => setPreviewingTemplate(template)}
                onUse={() => setNaming({ templateId: template.id, suggestedName: template.name })}
              />
            ))}
          </div>
          {visibleTemplates.length === 0 ? (
            <p className="template-gallery-empty">No templates match these filters.</p>
          ) : null}
        </div>
      </div>

      <TemplatePreviewModal
        open={previewingTemplate !== null}
        template={previewingTemplate}
        related={relatedTemplates}
        catalog={visibleTemplates}
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
