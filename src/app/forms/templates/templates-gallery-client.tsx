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
  industry: string | null;
  category: string | null;
  formType: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

type SortOption = 'newest' | 'az';
type FacetName = 'industry' | 'category' | 'formType';

const UNCATEGORISED = 'Uncategorised';

function facetValue(template: GalleryTemplate, facet: FacetName): string {
  return template[facet]?.trim() || UNCATEGORISED;
}

/** How closely `template` matches `reference` for the preview modal's "More like this"
 * row — form type is the most specific facet so it's weighted highest, industry the
 * broadest so it's weighted lowest. A template must share at least one facet to qualify. */
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`template-gallery-facet-chevron${open ? ' template-gallery-facet-chevron--open' : ''}`}
    >
      <path
        d="M3 4.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One collapsible sidebar section of checkboxes with live counts — used for the
 * Industry / Category / Form type facets. Counts reflect every other active filter
 * (search + the other two facets) so picking a value here never zeroes out its own
 * sibling options. */
function FacetSection({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { value: string; count: number }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  if (options.length === 0) return null;

  return (
    <div className="template-gallery-facet">
      <button
        type="button"
        className="template-gallery-facet-header"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <ul className="template-gallery-facet-list">
          {options.map((option) => (
            <li key={option.value}>
              <label className="template-gallery-facet-option">
                <input
                  type="checkbox"
                  checked={selected.has(option.value)}
                  onChange={() => onToggle(option.value)}
                />
                <span className="template-gallery-facet-label">{option.value}</span>
                <span className="template-gallery-facet-count">{option.count}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function TemplatesGalleryClient({ templates }: { templates: GalleryTemplate[] }) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedFormTypes, setSelectedFormTypes] = useState<Set<string>>(new Set());
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

  function toggleFacetValue(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

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

  function matchesFacets(template: GalleryTemplate, exclude?: FacetName): boolean {
    const industryOk =
      exclude === 'industry' ||
      selectedIndustries.size === 0 ||
      selectedIndustries.has(facetValue(template, 'industry'));
    const categoryOk =
      exclude === 'category' ||
      selectedCategories.size === 0 ||
      selectedCategories.has(facetValue(template, 'category'));
    const formTypeOk =
      exclude === 'formType' ||
      selectedFormTypes.size === 0 ||
      selectedFormTypes.has(facetValue(template, 'formType'));
    return industryOk && categoryOk && formTypeOk;
  }

  function buildFacetOptions(facet: FacetName) {
    const counts = new Map<string, number>();
    for (const template of templates) {
      if (!matchesSearch(template) || !matchesFacets(template, facet)) continue;
      const value = facetValue(template, facet);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: buildFacetOptions is redefined every render (it closes over search + the other two facets) — listing it would defeat the memo; the primitives below are its real dependencies
  const industryOptions = useMemo(
    () => buildFacetOptions('industry'),
    [templates, term, selectedCategories, selectedFormTypes],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: buildFacetOptions is redefined every render (it closes over search + the other two facets) — listing it would defeat the memo; the primitives below are its real dependencies
  const categoryOptions = useMemo(
    () => buildFacetOptions('category'),
    [templates, term, selectedIndustries, selectedFormTypes],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: buildFacetOptions is redefined every render (it closes over search + the other two facets) — listing it would defeat the memo; the primitives below are its real dependencies
  const formTypeOptions = useMemo(
    () => buildFacetOptions('formType'),
    [templates, term, selectedIndustries, selectedCategories],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: matchesSearch/matchesFacets are redefined every render (they close over search + facet selections) — listing them would defeat the memo; the primitives below are their real dependencies
  const visibleTemplates = useMemo(() => {
    const filtered = templates.filter(
      (template) => matchesSearch(template) && matchesFacets(template),
    );
    return [...filtered].sort((a, b) => {
      if (sortBy === 'az') return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [templates, term, selectedIndustries, selectedCategories, selectedFormTypes, sortBy]);

  const activeFilterCount =
    selectedIndustries.size + selectedCategories.size + selectedFormTypes.size;

  function clearFilters() {
    setSelectedIndustries(new Set());
    setSelectedCategories(new Set());
    setSelectedFormTypes(new Set());
  }

  const relatedTemplates = useMemo(() => {
    const current = previewingTemplate;
    if (!current) return [];
    return templates
      .filter((template) => template.id !== current.id)
      .map((template) => ({ template, score: relatedScore(template, current) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
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

  return (
    <div className="template-gallery-page">
      <header className="template-gallery-header">
        <h1 className="template-gallery-title">Choose a template</h1>
        <p className="template-gallery-lead">
          Start blank, or customize a template built for your industry.
        </p>
        <label className="template-gallery-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search templates"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search templates"
          />
        </label>
      </header>

      <div className="template-gallery-shell">
        <aside className="template-gallery-sidebar">
          <div className="template-gallery-facet">
            <p className="template-gallery-facet-title">Sort by</p>
            <ul className="template-gallery-facet-list">
              <li>
                <label className="template-gallery-facet-option template-gallery-facet-option--radio">
                  <input
                    type="radio"
                    name="template-sort"
                    checked={sortBy === 'newest'}
                    onChange={() => setSortBy('newest')}
                  />
                  <span className="template-gallery-facet-label">Newest</span>
                </label>
              </li>
              <li>
                <label className="template-gallery-facet-option template-gallery-facet-option--radio">
                  <input
                    type="radio"
                    name="template-sort"
                    checked={sortBy === 'az'}
                    onChange={() => setSortBy('az')}
                  />
                  <span className="template-gallery-facet-label">A–Z</span>
                </label>
              </li>
            </ul>
          </div>

          <FacetSection
            title="Industry"
            options={industryOptions}
            selected={selectedIndustries}
            onToggle={(value) =>
              setSelectedIndustries((current) => toggleFacetValue(current, value))
            }
          />
          <FacetSection
            title="Category"
            options={categoryOptions}
            selected={selectedCategories}
            onToggle={(value) =>
              setSelectedCategories((current) => toggleFacetValue(current, value))
            }
          />
          <FacetSection
            title="Form type"
            options={formTypeOptions}
            selected={selectedFormTypes}
            onToggle={(value) =>
              setSelectedFormTypes((current) => toggleFacetValue(current, value))
            }
          />

          {activeFilterCount > 0 ? (
            <button type="button" className="template-gallery-clear" onClick={clearFilters}>
              Clear filters ({activeFilterCount})
            </button>
          ) : null}
        </aside>

        <main className="template-gallery-main">
          {visibleTemplates.length === 0 && (term || activeFilterCount > 0) ? (
            <p className="template-gallery-empty">No templates match these filters.</p>
          ) : (
            <div className="template-gallery-grid">
              <button
                type="button"
                className="template-browse-card template-browse-card--blank"
                disabled={isCreating}
                onClick={() => setNaming({ suggestedName: '' })}
              >
                <span className="template-browse-card-art">
                  <span className="template-browse-card-blank-mark">+</span>
                  <span>Create blank</span>
                </span>
              </button>
              {visibleTemplates.map((template) => {
                const facets = [template.industry, template.category, template.formType].filter(
                  Boolean,
                );
                return (
                  <div key={template.id} className="template-browse-card">
                    <button
                      type="button"
                      className="template-browse-card-art"
                      onClick={() => setPreviewingTemplate(template)}
                    >
                      {template.thumbnailUrl ? (
                        // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize
                        <img src={template.thumbnailUrl} alt="" />
                      ) : (
                        <span className="template-browse-card-fallback">{template.name}</span>
                      )}
                    </button>
                    <div className="template-browse-card-body">
                      <p className="template-browse-card-title">{template.name}</p>
                      {facets.length > 0 ? (
                        <p className="template-browse-card-facets">{facets.join(' · ')}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="button button--dark template-browse-card-cta"
                      disabled={isCreating}
                      onClick={() =>
                        setNaming({ templateId: template.id, suggestedName: template.name })
                      }
                    >
                      Use Template
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

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
          setPreviewingTemplate(template as GalleryTemplate);
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
