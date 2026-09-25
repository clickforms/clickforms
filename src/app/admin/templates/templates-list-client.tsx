'use client';

import type { TemplateStatus } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useRef, useState } from 'react';
import { NewTemplateModal } from '@/app/admin/templates/new-template-modal';
import { TaxonomyField } from '@/app/admin/templates/taxonomy-field';
import { DropdownMenu } from '@/components/dropdown-menu';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';

export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  category: string | null;
  formType: string | null;
  status: TemplateStatus;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Distinct, non-empty values already used for one facet across a set of templates —
 * shared by the New Template modal and (via templates-list-client's own computation)
 * this list's search. Sorted so the <datalist> reads predictably. */
function distinctFacetValues(
  templates: TemplateRow[],
  facet: 'industry' | 'category' | 'formType',
) {
  return Array.from(
    new Set(templates.map((template) => template[facet]).filter(Boolean)),
  ).sort() as string[];
}

const STATUS_FILTERS = ['all', 'draft', 'published', 'archived'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const STATUS_BADGE_CLASS: Record<TemplateStatus, string> = {
  draft: 'badge--draft',
  published: 'badge--success',
  archived: 'badge--neutral',
};

const STATUS_LABELS: Record<TemplateStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="3.25" r="1.15" fill="currentColor" />
      <circle cx="8" cy="8" r="1.15" fill="currentColor" />
      <circle cx="8" cy="12.75" r="1.15" fill="currentColor" />
    </svg>
  );
}

function PlaceholderThumbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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

function TemplateRowMenu({
  template,
  busy,
  onEdit,
  onRecategorize,
  onPreview,
  onSetStatus,
  onDelete,
}: {
  template: TemplateRow;
  busy: boolean;
  onEdit: () => void;
  onRecategorize: () => void;
  onPreview: () => void;
  onSetStatus: (status: TemplateStatus) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="admin-orgs-more"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${template.name}`}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreIcon />
      </button>
      <DropdownMenu open={open} onOpenChange={setOpen} triggerRef={triggerRef} align="end">
        {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern, matches DropdownMenu's usage elsewhere in the app */}
        <ul role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="actions-menu-item"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              Edit
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="actions-menu-item"
              onClick={() => {
                setOpen(false);
                onRecategorize();
              }}
            >
              Recategorize
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="actions-menu-item"
              onClick={() => {
                setOpen(false);
                onPreview();
              }}
            >
              Preview
            </button>
          </li>
          {template.status !== 'published' ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="actions-menu-item"
                onClick={() => {
                  setOpen(false);
                  onSetStatus('published');
                }}
              >
                Publish
              </button>
            </li>
          ) : null}
          {template.status === 'published' ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="actions-menu-item"
                onClick={() => {
                  setOpen(false);
                  onSetStatus('archived');
                }}
              >
                Archive
              </button>
            </li>
          ) : null}
          {template.status === 'archived' ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="actions-menu-item"
                onClick={() => {
                  setOpen(false);
                  onSetStatus('draft');
                }}
              >
                Move to draft
              </button>
            </li>
          ) : null}
          <li role="none">
            <hr className="actions-menu-divider" />
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="actions-menu-item actions-menu-item--danger"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              Delete
            </button>
          </li>
        </ul>
      </DropdownMenu>
    </div>
  );
}

export function TemplatesListClient({ initialTemplates }: { initialTemplates: TemplateRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [templates, setTemplates] = useState(initialTemplates);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<TemplateRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recategorizing, setRecategorizing] = useState<TemplateRow | null>(null);
  const [draftIndustry, setDraftIndustry] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftFormType, setDraftFormType] = useState('');
  const [isRecategorizing, setIsRecategorizing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isBulkActing, setIsBulkActing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: templates.length,
      draft: 0,
      published: 0,
      archived: 0,
    };
    for (const template of templates) {
      counts[template.status] += 1;
    }
    return counts;
  }, [templates]);

  const visibleTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = templates.filter((template) => {
      if (statusFilter !== 'all' && template.status !== statusFilter) return false;
      if (!term) return true;
      return (
        template.name.toLowerCase().includes(term) ||
        (template.industry ?? '').toLowerCase().includes(term) ||
        (template.category ?? '').toLowerCase().includes(term) ||
        (template.formType ?? '').toLowerCase().includes(term)
      );
    });
    return [...filtered].sort((a, b) => {
      const delta = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDirection === 'asc' ? delta : -delta;
    });
  }, [templates, search, statusFilter, sortDirection]);

  const allVisibleSelected =
    visibleTemplates.length > 0 &&
    visibleTemplates.every((template) => selectedIds.has(template.id));
  const someVisibleSelected = visibleTemplates.some((template) => selectedIds.has(template.id));

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const template of visibleTemplates) next.delete(template.id);
      } else {
        for (const template of visibleTemplates) next.add(template.id);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Suggestions for the New Template modal's three taxonomy fields — every distinct
  // value already used for that facet across the existing library.
  const industryOptions = useMemo(() => distinctFacetValues(templates, 'industry'), [templates]);
  const categoryOptions = useMemo(() => distinctFacetValues(templates, 'category'), [templates]);
  const formTypeOptions = useMemo(() => distinctFacetValues(templates, 'formType'), [templates]);

  async function handleSetStatus(template: TemplateRow, status: TemplateStatus) {
    setBusyId(template.id);
    try {
      const response = await fetch(`/api/admin/form-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not update template status'));
      }
      setTemplates((current) =>
        current.map((row) => (row.id === template.id ? { ...row, status } : row)),
      );
      toast.success(`Template ${STATUS_LABELS[status].toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update template status');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingTemplate) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/form-templates/${deletingTemplate.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to delete template'));
      }
      setTemplates((current) => current.filter((row) => row.id !== deletingTemplate.id));
      toast.success('Template deleted');
      setDeletingTemplate(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setIsDeleting(false);
    }
  }

  function openRecategorize(template: TemplateRow) {
    setRecategorizing(template);
    setDraftIndustry(template.industry ?? '');
    setDraftCategory(template.category ?? '');
    setDraftFormType(template.formType ?? '');
  }

  async function handleRecategorizeSubmit(event: FormEvent) {
    event.preventDefault();
    if (!recategorizing) return;
    setIsRecategorizing(true);
    try {
      const response = await fetch(`/api/admin/form-templates/${recategorizing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: draftIndustry.trim(),
          category: draftCategory.trim(),
          formType: draftFormType.trim(),
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not update categorisation'));
      }
      const { template: updated } = await response.json();
      setTemplates((current) =>
        current.map((row) =>
          row.id === recategorizing.id
            ? {
                ...row,
                industry: updated.industry,
                category: updated.category,
                formType: updated.formType,
              }
            : row,
        ),
      );
      toast.success('Template recategorised');
      setRecategorizing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update categorisation');
    } finally {
      setIsRecategorizing(false);
    }
  }

  /** Applies one status to every currently-selected template. Runs the PATCH calls in
   * parallel (each is an independent row update, same as the per-row menu's onSetStatus)
   * and reports how many failed rather than aborting the whole batch on one error. */
  async function handleBulkSetStatus(status: TemplateStatus) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkActing(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const response = await fetch(`/api/admin/form-templates/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status }),
            });
            return { id, ok: response.ok };
          } catch {
            return { id, ok: false };
          }
        }),
      );
      const succeededIds = new Set(
        results.filter((result) => result.ok).map((result) => result.id),
      );
      setTemplates((current) =>
        current.map((row) => (succeededIds.has(row.id) ? { ...row, status } : row)),
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of succeededIds) next.delete(id);
        return next;
      });
      const failedCount = ids.length - succeededIds.size;
      if (failedCount > 0) {
        toast.error(
          `${STATUS_LABELS[status]} applied to ${succeededIds.size}, but ${failedCount} failed`,
        );
      } else {
        toast.success(
          `${succeededIds.size} template${succeededIds.size === 1 ? '' : 's'} ${STATUS_LABELS[status].toLowerCase()}`,
        );
      }
    } finally {
      setIsBulkActing(false);
    }
  }

  async function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkActing(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const response = await fetch(`/api/admin/form-templates/${id}`, { method: 'DELETE' });
            return { id, ok: response.ok };
          } catch {
            return { id, ok: false };
          }
        }),
      );
      const succeededIds = new Set(
        results.filter((result) => result.ok).map((result) => result.id),
      );
      setTemplates((current) => current.filter((row) => !succeededIds.has(row.id)));
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of succeededIds) next.delete(id);
        return next;
      });
      const failedCount = ids.length - succeededIds.size;
      if (failedCount > 0) {
        toast.error(`Deleted ${succeededIds.size}, but ${failedCount} failed`);
      } else {
        toast.success(`${succeededIds.size} template${succeededIds.size === 1 ? '' : 's'} deleted`);
      }
      setBulkDeleting(false);
    } finally {
      setIsBulkActing(false);
    }
  }

  return (
    <div className="admin-orgs">
      <header className="admin-orgs-header">
        <div>
          <h1 className="admin-orgs-title">Templates</h1>
          <p className="admin-orgs-lead">
            Reusable forms organisations can copy and make their own from the /forms/templates
            gallery.
          </p>
        </div>
        <button type="button" className="button button--dark" onClick={() => setCreateOpen(true)}>
          <PlusIcon /> New template
        </button>
      </header>

      <NewTemplateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        industryOptions={industryOptions}
        categoryOptions={categoryOptions}
        formTypeOptions={formTypeOptions}
      />

      {deletingTemplate ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
        <div className="modal-overlay" onMouseDown={() => !isDeleting && setDeletingTemplate(null)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-template-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title" id="delete-template-title">
                Delete "{deletingTemplate.name}"?
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeletingTemplate(null)}
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
                className="button button--secondary"
                onClick={() => setDeletingTemplate(null)}
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

      {recategorizing ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
        <div
          className="modal-overlay"
          onMouseDown={() => !isRecategorizing && setRecategorizing(null)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recategorize-template-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title" id="recategorize-template-title">
                Recategorize "{recategorizing.name}"
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setRecategorizing(null)}
                aria-label="Close"
                disabled={isRecategorizing}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleRecategorizeSubmit}>
              <div className="admin-template-fields">
                <TaxonomyField
                  label="Industry"
                  placeholder="e.g. Healthcare"
                  value={draftIndustry}
                  onChange={setDraftIndustry}
                  options={industryOptions}
                  disabled={isRecategorizing}
                />
                <TaxonomyField
                  label="Category"
                  placeholder="e.g. NDIS, Childcare"
                  value={draftCategory}
                  onChange={setDraftCategory}
                  options={categoryOptions}
                  disabled={isRecategorizing}
                />
                <TaxonomyField
                  label="Form type"
                  placeholder="e.g. Incident & safety"
                  value={draftFormType}
                  onChange={setDraftFormType}
                  options={formTypeOptions}
                  disabled={isRecategorizing}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setRecategorizing(null)}
                  disabled={isRecategorizing}
                >
                  Cancel
                </button>
                <button className="button" type="submit" disabled={isRecategorizing}>
                  {isRecategorizing ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {bulkDeleting ? (
        // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-dismiss backdrop; the modal has a keyboard-reachable Close button
        <div className="modal-overlay" onMouseDown={() => !isBulkActing && setBulkDeleting(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title" id="bulk-delete-title">
                Delete {selectedIds.size} template{selectedIds.size === 1 ? '' : 's'}?
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setBulkDeleting(false)}
                aria-label="Close"
                disabled={isBulkActing}
              >
                ×
              </button>
            </div>
            <p className="modal-body-text">
              This removes them from the template gallery. Forms organisations already created from
              them are never affected — this only deletes the templates themselves.
            </p>
            <div className="modal-footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setBulkDeleting(false)}
                disabled={isBulkActing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={() => void handleBulkDeleteConfirm()}
                disabled={isBulkActing}
              >
                {isBulkActing ? 'Deleting…' : 'Delete templates'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {templates.length === 0 ? (
        <section className="admin-home-empty">
          <div>
            <h2 className="admin-home-empty-title">No templates yet</h2>
            <p className="admin-home-empty-copy">
              Create the first template — publish it and organisations can copy it into their own
              workspace.
            </p>
            <button
              type="button"
              className="button button--dark"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon /> New template
            </button>
          </div>
        </section>
      ) : (
        <div className="card admin-orgs-card">
          <div className="admin-orgs-toolbar">
            <label className="admin-orgs-search">
              <span className="admin-orgs-search-icon">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder="Search templates..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search templates"
              />
            </label>
            <div className="admin-orgs-chips" role="tablist" aria-label="Filter by status">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`admin-orgs-chip${statusFilter === filter ? ' admin-orgs-chip--active' : ''}`}
                  onClick={() => setStatusFilter(filter)}
                >
                  <span className={`admin-orgs-chip-dot admin-orgs-chip-dot--${filter}`} />
                  {STATUS_FILTER_LABELS[filter]} {statusCounts[filter]}
                </button>
              ))}
            </div>
          </div>

          {selectedIds.size > 0 ? (
            <div className="admin-orgs-bulk-bar">
              <span className="admin-orgs-bulk-count">{selectedIds.size} selected</span>
              <button
                type="button"
                className="button button--secondary"
                disabled={isBulkActing}
                onClick={() => void handleBulkSetStatus('published')}
              >
                Publish
              </button>
              <button
                type="button"
                className="button button--secondary"
                disabled={isBulkActing}
                onClick={() => void handleBulkSetStatus('archived')}
              >
                Archive
              </button>
              <button
                type="button"
                className="button button--ghost-danger"
                disabled={isBulkActing}
                onClick={() => setBulkDeleting(true)}
              >
                Delete
              </button>
              <button
                type="button"
                className="admin-orgs-bulk-clear"
                disabled={isBulkActing}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
            </div>
          ) : null}

          <div className="admin-table-scroll">
            <table className="admin-orgs-table">
              <thead>
                <tr>
                  <th className="admin-orgs-table-check">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={visibleTemplates.length === 0}
                      ref={(input) => {
                        if (input) input.indeterminate = someVisibleSelected && !allVisibleSelected;
                      }}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all templates"
                    />
                  </th>
                  <th>Template</th>
                  <th>Industry</th>
                  <th>Category</th>
                  <th>Form type</th>
                  <th>Status</th>
                  <th>
                    <button
                      type="button"
                      className="table-sort-button"
                      onClick={() =>
                        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
                      }
                    >
                      Updated
                      <span className="table-sort-stack" aria-hidden="true">
                        <span
                          className={
                            sortDirection === 'asc'
                              ? 'table-sort-arrow table-sort-arrow--active'
                              : 'table-sort-arrow'
                          }
                        >
                          ▲
                        </span>
                        <span
                          className={
                            sortDirection === 'desc'
                              ? 'table-sort-arrow table-sort-arrow--active'
                              : 'table-sort-arrow'
                          }
                        >
                          ▼
                        </span>
                      </span>
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTemplates.map((template) => {
                  const detailHref = `/admin/templates/${template.id}`;
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: must stay a <tr> for correct table semantics — role="button" + tabIndex + onKeyDown supply the missing button affordance instead of nesting a real <button> around table cells
                    <tr
                      key={template.id}
                      className="forms-row--clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(detailHref)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(detailHref);
                        }
                      }}
                    >
                      <td
                        className="admin-orgs-table-check"
                        data-label="Select"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(template.id)}
                          onChange={() => toggleSelect(template.id)}
                          aria-label={`Select ${template.name}`}
                        />
                      </td>
                      <td data-label="Template">
                        <span className="users-name-cell">
                          <span className="template-row-thumb" aria-hidden="true">
                            {template.thumbnailUrl ? (
                              // biome-ignore lint/performance/noImgElement: presigned S3 URL, not a static asset next/image can optimize
                              <img src={template.thumbnailUrl} alt="" />
                            ) : (
                              <PlaceholderThumbIcon />
                            )}
                          </span>
                          <span className="users-name-text">{template.name}</span>
                        </span>
                      </td>
                      <td data-label="Industry">{template.industry || '—'}</td>
                      <td data-label="Category">{template.category || '—'}</td>
                      <td data-label="Form type">{template.formType || '—'}</td>
                      <td data-label="Status">
                        <span className={`badge ${STATUS_BADGE_CLASS[template.status]}`}>
                          {STATUS_LABELS[template.status]}
                        </span>
                      </td>
                      <td data-label="Updated">
                        {new Date(template.updatedAt).toLocaleDateString('en-AU')}
                      </td>
                      <td
                        data-label="Actions"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <TemplateRowMenu
                          template={template}
                          busy={busyId === template.id}
                          onEdit={() => router.push(detailHref)}
                          onRecategorize={() => openRecategorize(template)}
                          onPreview={() =>
                            window.open(
                              `/template-preview/${template.id}`,
                              '_blank',
                              'noopener,noreferrer',
                            )
                          }
                          onSetStatus={(status) => void handleSetStatus(template, status)}
                          onDelete={() => setDeletingTemplate(template)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {visibleTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-table-empty">
                      No templates match that search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="admin-orgs-footer">
            <span>
              {visibleTemplates.length} {visibleTemplates.length === 1 ? 'template' : 'templates'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
