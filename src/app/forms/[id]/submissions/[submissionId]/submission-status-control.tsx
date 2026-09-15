'use client';

import type { SubmissionStatus } from '@prisma/client';
import { type CSSProperties, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';

// Same three manual review states as the Responses table's status dropdown (see
// submission-status-menu.tsx for why 'in_progress' is excluded and 'approved'/'rejected'
// are reused under the "Finalised"/"Rejected" labels rather than new enum values).
const REVIEW_STATUSES: { value: SubmissionStatus; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Finalised' },
  { value: 'rejected', label: 'Rejected' },
];

// Local copy rather than a shared import — page.tsx and submissions-list-client.tsx
// already each keep their own copy of this map, so this follows the same convention.
const SUBMISSION_STATUS_BADGE: Record<SubmissionStatus, { label: string; className: string }> = {
  in_progress: { label: 'In progress', className: 'badge--neutral' },
  // Matches the "Submitted" badge on the org-wide Files page (forms/files/page.tsx) —
  // neutral gray rather than green, since "submitted" just means "awaiting review".
  submitted: { label: 'Submitted', className: 'badge--neutral' },
  approved: { label: 'Approved', className: 'badge--success' },
  rejected: { label: 'Rejected', className: 'badge--error' },
};

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
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

// Same "anchor under the trigger, flip above if it would overflow" strategy as the other
// portal-based menus in this app (form-actions-menu.tsx, submission-status-menu.tsx,
// submission-answers-editor.tsx) — kept as its own copy since none of these share a
// component yet.
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

interface SubmissionStatusControlProps {
  formId: string;
  submissionId: string;
  initialStatus: SubmissionStatus;
  /** Same trust boundary as deleting/editing the response (canEditForm on the server,
   * assertFormEditAccess on the status route) — a viewer without that access just sees
   * the plain badge from the meta card, unchanged from before this control existed. */
  canChange: boolean;
}

/**
 * Lets a manager change a response's review status from the detail page, not just the
 * Responses table — same PATCH .../status endpoint and freely-reversible behavior as
 * SubmissionStatusMenu, applied instantly with an optimistic update and rolled back on
 * failure.
 */
export function SubmissionStatusControl({
  formId,
  submissionId,
  initialStatus,
  canChange,
}: SubmissionStatusControlProps) {
  const [status, setStatus] = useState(initialStatus);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const toast = useToast();

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

  const badge = SUBMISSION_STATUS_BADGE[status];

  if (!canChange) {
    return (
      <span className={`submission-status-chip submission-status-chip--${status}`}>
        <span className="submission-status-dot" aria-hidden="true" />
        {badge.label}
      </span>
    );
  }

  async function handleSelect(next: SubmissionStatus) {
    setOpen(false);
    if (next === status) return;

    const previous = status;
    setStatus(next);
    setSaving(true);
    try {
      const response = await fetch(`/api/forms/${formId}/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to update status'));
      }
      toast.success(`Marked as ${SUBMISSION_STATUS_BADGE[next].label}`);
    } catch (err) {
      setStatus(previous);
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  const panel =
    open && typeof document !== 'undefined' ? (
      <ul
        ref={panelRef}
        className="actions-menu-panel"
        id={menuId}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: WAI-ARIA APG menu pattern, matches submission-status-menu.tsx elsewhere in the app
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
              onClick={() => void handleSelect(option.value)}
            >
              <span className="actions-menu-icon actions-menu-check">
                {option.value === status ? <CheckIcon /> : null}
              </span>
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div className="actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`submission-status-chip submission-status-chip--${status} submission-status-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={saving}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="submission-status-dot" aria-hidden="true" />
        {badge.label}
        <ChevronIcon />
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
