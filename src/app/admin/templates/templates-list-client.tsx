'use client';

import type { TemplateStatus } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { NewTemplateModal } from '@/app/admin/templates/new-template-modal';
import { DropdownMenu } from '@/components/dropdown-menu';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';

export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: TemplateStatus;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
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
  onPreview,
  onSetStatus,
  onDelete,
}: {
  template: TemplateRow;
  busy: boolean;
  onEdit: () => void;
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
    return templates.filter((template) => {
      if (statusFilter !== 'all' && template.status !== statusFilter) return false;
      if (!term) return true;
      return (
        template.name.toLowerCase().includes(term) ||
        (template.category ?? '').toLowerCase().includes(term)
      );
    });
  }, [templates, search, statusFilter]);

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

      <NewTemplateModal open={createOpen} onClose={() => setCreateOpen(false)} />

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
                  {STATUS_FILTER_LABELS[filter]} {statusCounts[filter]}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-orgs-table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Updated</th>
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
                      <td data-label="Category">{template.category || '—'}</td>
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
                          onEdit={() => router.push(`/admin/templates/${template.id}/builder`)}
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
                    <td colSpan={5} className="admin-table-empty">
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
