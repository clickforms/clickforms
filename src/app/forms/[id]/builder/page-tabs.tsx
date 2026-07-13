'use client';

import { useState } from 'react';
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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

  return (
    <div className="page-tabs">
      {pages.map((page, index) => (
        <div
          key={page.id}
          className={`page-tab ${page.id === activePageId ? 'page-tab--active' : ''}`}
        >
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
            <button
              type="button"
              className="page-tab-label"
              onClick={() => onSelectPage(page.id)}
              onDoubleClick={() => {
                if (!canEdit) return;
                setRenamingId(page.id);
                setRenameValue(page.title);
              }}
            >
              {index + 1}. {page.title}
            </button>
          )}

          {canEdit && page.id === activePageId && (
            <div className="page-tab-controls">
              <button
                type="button"
                className="page-tab-move"
                disabled={index === 0}
                onClick={() => onMovePage(page.id, 'left')}
                aria-label="Move page earlier"
              >
                &larr;
              </button>
              <button
                type="button"
                className="page-tab-move"
                disabled={index === pages.length - 1}
                onClick={() => onMovePage(page.id, 'right')}
                aria-label="Move page later"
              >
                &rarr;
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
          )}
        </div>
      ))}

      {canEdit && (
        <button
          type="button"
          className="button button--ghost button--small page-tab-add"
          onClick={onAddPage}
        >
          + Add page
        </button>
      )}
    </div>
  );
}
