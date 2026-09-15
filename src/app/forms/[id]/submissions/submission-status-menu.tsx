'use client';

import type { SubmissionStatus } from '@prisma/client';
import { type CSSProperties, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** The statuses a manager can move a response through — see the status route's comment
 * for why 'approved'/'rejected' are reused under different labels rather than adding new
 * enum values. Excludes 'in_progress', which is never something staff toggle into. */
const REVIEW_STATUSES: { value: SubmissionStatus; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Finalised' },
  { value: 'rejected', label: 'Rejected' },
];

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
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

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.3 5 8.8l4.5-5.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h10M6 4.5V3.2c0-.5.4-.9.9-.9h2.2c.5 0 .9.4.9.9v1.3M5.5 7v4.8M10.5 7v4.8M3.8 4.5l.5 8.2c.05.6.55 1 1.1 1h5.2c.55 0 1.05-.4 1.1-1l.5-8.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5v7M4.8 7l3.2 3.2L11.2 7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12v.8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Same fixed/portal positioning strategy as FormActionsMenu — the table this renders
// inside scrolls its own container, so a plain absolutely-positioned panel would get
// clipped; portaling to document.body and computing fixed coordinates avoids that.
function computePanelStyle(trigger: HTMLElement, panel: HTMLElement): CSSProperties {
  const triggerRect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const gap = 6;
  const viewportPadding = 8;

  let top = triggerRect.bottom + gap;
  if (top + panelRect.height > window.innerHeight - viewportPadding) {
    const aboveTop = triggerRect.top - panelRect.height - gap;
    top = aboveTop >= viewportPadding ? aboveTop : viewportPadding;
  }

  let left = triggerRect.right - panelRect.width;
  left = Math.max(
    viewportPadding,
    Math.min(left, window.innerWidth - panelRect.width - viewportPadding),
  );

  return { position: 'fixed', top, left };
}

interface SubmissionStatusMenuProps {
  status: SubmissionStatus;
  onStatusChange: (status: SubmissionStatus) => void;
  onDelete: () => void;
  onExportPdf: () => Promise<void>;
  isExporting: boolean;
}

/** Actions-column dropdown on the Responses table — lets a manager move a response
 * between Submitted/Finalised/Rejected (freely reversible, applied instantly), download
 * its PDF, and delete it. Status colouring itself lives in the Status column's badge
 * (SUBMISSION_STATUS_BADGE in submissions-list-client.tsx); this menu is just the control
 * surface. Only ever rendered for a caller who already passed the same
 * canDelete/canEditForm check — see submissions-list-client.tsx — so status changes,
 * export, and delete all share one trust boundary rather than this component re-deriving
 * a second permission. */
export function SubmissionStatusMenu({
  status,
  onStatusChange,
  onDelete,
  onExportPdf,
  isExporting,
}: SubmissionStatusMenuProps) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    setPanelStyle(computePanelStyle(triggerRef.current, panelRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function reposition() {
      if (!triggerRef.current || !panelRef.current) return;
      setPanelStyle(computePanelStyle(triggerRef.current, panelRef.current));
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setPanelStyle(null);
  }, [open]);

  function close() {
    setOpen(false);
  }

  const panel =
    open && typeof document !== 'undefined' ? (
      <ul
        ref={panelRef}
        className="actions-menu-panel"
        id={menuId}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern, matches FormActionsMenu elsewhere in the app
        role="menu"
        style={{ ...panelStyle, visibility: panelStyle ? 'visible' : 'hidden' }}
      >
        {REVIEW_STATUSES.map((option) => (
          <li key={option.value} role="none">
            <button
              type="button"
              className="actions-menu-item"
              role="menuitemradio"
              aria-checked={option.value === status}
              onClick={() => {
                if (option.value !== status) onStatusChange(option.value);
                close();
              }}
            >
              <span className="actions-menu-icon actions-menu-check">
                {option.value === status ? <CheckIcon /> : null}
              </span>
              {option.label}
            </button>
          </li>
        ))}
        <li role="none">
          <hr className="actions-menu-divider" />
        </li>
        <li role="none">
          <button
            type="button"
            className="actions-menu-item"
            role="menuitem"
            disabled={isExporting}
            onClick={() => {
              // Deliberately not closing the menu immediately (unlike every other item
              // here) — export can take a few seconds (server-side PDF rendering), and
              // closing right away would throw away the only place "Downloading…" is
              // visible. Closes itself once the request settles either way, same pattern
              // as the submission detail page's own export button.
              void onExportPdf().then(close);
            }}
          >
            <span className="actions-menu-icon">
              {isExporting ? (
                <span className="actions-menu-spinner" aria-hidden="true" />
              ) : (
                <DownloadIcon />
              )}
            </span>
            {isExporting ? 'Downloading…' : 'Download PDF'}
          </button>
        </li>
        <li role="none">
          <hr className="actions-menu-divider" />
        </li>
        <li role="none">
          <button
            type="button"
            className="actions-menu-item actions-menu-item--danger"
            role="menuitem"
            onClick={() => {
              onDelete();
              close();
            }}
          >
            <span className="actions-menu-icon">
              <TrashIcon />
            </span>
            Delete
          </button>
        </li>
      </ul>
    ) : null;

  return (
    <div className="actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="actions-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        Actions
        <ChevronIcon />
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
