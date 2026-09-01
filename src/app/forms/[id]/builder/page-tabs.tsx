'use client';

import { useRef, useState } from 'react';
import { DropdownMenu } from '@/components/dropdown-menu';
import type { FormPage } from '@/lib/forms/schema';

interface PageTabsProps {
  pages: FormPage[];
  activePageId: string;
  canEdit: boolean;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onMovePage: (pageId: string, direction: 'left' | 'right') => void;
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3.5 5.5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 6 8 10.5 12.5 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="10" height="12" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.5 2.5l3 3L5.5 13.5H2.5v-3L10.5 2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PageTabs({
  pages,
  activePageId,
  canEdit,
  onSelectPage,
  onAddPage,
  onRemovePage,
  onRenamePage,
  onMovePage,
}: PageTabsProps) {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeIndex = pages.findIndex((page) => page.id === activePageId);
  const activePage = pages[activeIndex];

  function commitRename(pageId: string) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (title) {
      onRenamePage(pageId, title);
    }
  }

  function handleRemove(page: FormPage) {
    if (page.fields.length > 0) {
      const confirmed = window.confirm(
        `"${page.title}" has ${page.fields.length} field${page.fields.length === 1 ? '' : 's'} on it. Remove this page and its fields?`,
      );
      if (!confirmed) return;
    }
    onRemovePage(page.id);
  }

  function handleStep(direction: -1 | 1) {
    const target = pages[activeIndex + direction];
    if (target) onSelectPage(target.id);
  }

  return (
    <div className="page-switcher">
      <button
        type="button"
        className="page-switcher-step"
        onClick={() => handleStep(-1)}
        disabled={activeIndex <= 0}
        aria-label="Previous page"
      >
        <ChevronLeftIcon />
      </button>

      <button
        ref={triggerRef}
        type="button"
        className="page-switcher-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
      >
        <PageIcon />
        <span className="page-switcher-trigger-label">
          {activePage?.title ?? 'Page'}
          <span className="page-switcher-trigger-count"> of {pages.length}</span>
        </span>
        <ChevronDownIcon />
      </button>

      <button
        type="button"
        className="page-switcher-step"
        onClick={() => handleStep(1)}
        disabled={activeIndex === -1 || activeIndex >= pages.length - 1}
        aria-label="Next page"
      >
        <ChevronRightIcon />
      </button>

      {canEdit ? (
        <button
          type="button"
          className="button button--ghost button--small page-tab-add"
          onClick={onAddPage}
        >
          + Add page
        </button>
      ) : null}

      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        triggerRef={triggerRef}
        panelClassName="actions-menu-panel page-switcher-panel"
      >
        <ul className="page-switcher-list">
          {pages.map((page, index) => (
            <li key={page.id}>
              {canEdit && renamingId === page.id ? (
                <input
                  className="text-input page-tab-rename-input"
                  value={renameValue}
                  // biome-ignore lint/a11y/noAutofocus: user just clicked "rename" — focusing the field they're about to type into is the expected behavior
                  autoFocus
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={() => commitRename(page.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename(page.id);
                    if (event.key === 'Escape') setRenamingId(null);
                  }}
                />
              ) : (
                <div
                  className={`page-switcher-row ${page.id === activePageId ? 'page-switcher-row--active' : ''}`}
                >
                  <button
                    type="button"
                    className="page-switcher-row-label"
                    onClick={() => {
                      onSelectPage(page.id);
                      setOpen(false);
                    }}
                  >
                    <span className="page-switcher-row-index">{index + 1}</span>
                    {page.title}
                  </button>
                  {canEdit ? (
                    <div className="page-switcher-row-actions">
                      <button
                        type="button"
                        className="page-tab-move"
                        onClick={() => {
                          setRenamingId(page.id);
                          setRenameValue(page.title);
                        }}
                        aria-label="Rename page"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="page-tab-move"
                        disabled={index === 0}
                        onClick={() => onMovePage(page.id, 'left')}
                        aria-label="Move page earlier"
                      >
                        &uarr;
                      </button>
                      <button
                        type="button"
                        className="page-tab-move"
                        disabled={index === pages.length - 1}
                        onClick={() => onMovePage(page.id, 'right')}
                        aria-label="Move page later"
                      >
                        &darr;
                      </button>
                      <button
                        type="button"
                        className="page-tab-remove"
                        disabled={pages.length <= 1}
                        onClick={() => handleRemove(page)}
                        aria-label="Remove page"
                      >
                        &times;
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      </DropdownMenu>
    </div>
  );
}
