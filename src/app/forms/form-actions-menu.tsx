'use client';

import type { FormStatus } from '@prisma/client';
import Link from 'next/link';
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  type FormWorkflowAction,
  getWorkflowStepForStatus,
} from '@/lib/forms/form-workflow-client';

interface FormActionsMenuProps {
  formId: string;
  formSlug: string;
  status: FormStatus;
  canEdit: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onToggleArchive: () => void;
  onWorkflow: (action: FormWorkflowAction) => void;
  onDelete: () => void;
}

type MenuItem =
  | { kind: 'link'; label: string; href: string; icon: ReactNode; external?: boolean }
  | { kind: 'button'; label: string; icon: ReactNode; onClick: () => void }
  | { kind: 'disabled'; label: string; icon: ReactNode; title?: string }
  | { kind: 'divider' }
  | { kind: 'danger'; label: string; icon: ReactNode; onClick: () => void };

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.5 2.5l3 3L5.5 13.5H2.5v-3L10.5 2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 12.5h10M5.5 10.5L11 5l2 2-5.5 5.5H5.5v-2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 10.5h-1a1 1 0 01-1-1v-6a1 1 0 011-1h6a1 1 0 011 1v1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.5 7V5.5a2.5 2.5 0 015 0V7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ViewFormIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11.5 11.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ResponsesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.5 5.5l5.5 3.5 5.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5v7M5.5 7 8 9.5 10.5 7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.5v1.5a1 1 0 001 1h8a1 1 0 001-1v-1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 4.5h9M6 4.5V3.5h4v1M5.5 4.5l.5 8h4l.5-8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UnpublishIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <line
        x1="4.5"
        y1="11.5"
        x2="11.5"
        y2="4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ApproveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 8.5l2.5 2.5L12 5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PublishIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 3v7M5.5 7.5L8 10l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.5 12.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

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

function MenuEntry({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  if (item.kind === 'divider') {
    return (
      <li role="none">
        <hr className="actions-menu-divider" />
      </li>
    );
  }

  if (item.kind === 'link') {
    const linkProps = item.external
      ? { target: '_blank' as const, rel: 'noopener noreferrer' }
      : {};

    return (
      <li role="none">
        <Link
          href={item.href}
          className="actions-menu-item"
          role="menuitem"
          onClick={onClose}
          {...linkProps}
        >
          <span className="actions-menu-icon">{item.icon}</span>
          {item.label}
        </Link>
      </li>
    );
  }

  if (item.kind === 'button') {
    return (
      <li role="none">
        <button
          type="button"
          className="actions-menu-item"
          role="menuitem"
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          <span className="actions-menu-icon">{item.icon}</span>
          {item.label}
        </button>
      </li>
    );
  }

  if (item.kind === 'danger') {
    return (
      <li role="none">
        <button
          type="button"
          className="actions-menu-item actions-menu-item--danger"
          role="menuitem"
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          <span className="actions-menu-icon">{item.icon}</span>
          {item.label}
        </button>
      </li>
    );
  }

  return (
    <li role="none">
      <span
        className="actions-menu-item actions-menu-item--disabled"
        title={item.title ?? 'Coming soon'}
      >
        <span className="actions-menu-icon">{item.icon}</span>
        {item.label}
      </span>
    </li>
  );
}

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

export function FormActionsMenu({
  formId,
  formSlug,
  status,
  canEdit,
  onRename,
  onDuplicate,
  onToggleArchive,
  onWorkflow,
  onDelete,
}: FormActionsMenuProps) {
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
      if (event.key === 'Escape') {
        setOpen(false);
      }
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
    if (!open) {
      setPanelStyle(null);
    }
  }, [open]);

  const items: MenuItem[] = [];
  const isArchived = status === 'archived';
  const workflowStep = getWorkflowStepForStatus(status);

  if (canEdit) {
    items.push(
      { kind: 'link', label: 'Edit', href: `/forms/${formId}/builder`, icon: <EditIcon /> },
      { kind: 'button', label: 'Rename', icon: <RenameIcon />, onClick: onRename },
      { kind: 'button', label: 'Duplicate', icon: <DuplicateIcon />, onClick: onDuplicate },
    );

    if (workflowStep) {
      const icon =
        workflowStep.action === 'approve' ? (
          <ApproveIcon />
        ) : workflowStep.action === 'publish' ? (
          <PublishIcon />
        ) : (
          <UnpublishIcon />
        );
      items.push({
        kind: 'button',
        label: workflowStep.label,
        icon,
        onClick: () => onWorkflow(workflowStep.action),
      });
    }

    items.push({
      kind: 'button',
      label: isArchived ? 'Restore' : 'Archive',
      icon: <LockIcon />,
      onClick: onToggleArchive,
    });
  } else {
    items.push({
      kind: 'link',
      label: 'View',
      href: `/forms/${formId}/builder`,
      icon: <EditIcon />,
    });
  }

  if (status === 'published') {
    items.push({
      kind: 'link',
      label: 'View form',
      href: `/f/${formSlug}`,
      icon: <ViewFormIcon />,
      external: true,
    });
  }

  items.push(
    {
      kind: 'link',
      label: 'View responses',
      href: `/forms/${formId}/submissions`,
      icon: <ResponsesIcon />,
    },
    { kind: 'disabled', label: 'Export responses', icon: <ExportIcon /> },
  );

  if (canEdit) {
    items.push(
      { kind: 'divider' },
      { kind: 'danger', label: 'Delete', icon: <DeleteIcon />, onClick: onDelete },
    );
  }

  const panel =
    open && typeof document !== 'undefined' ? (
      <ul
        ref={panelRef}
        className="actions-menu-panel"
        id={menuId}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: this is the WAI-ARIA APG menu pattern (ul[role=menu] > li[role=none] > [role=menuitem]) — the recommended accessible implementation, not an oversight
        role="menu"
        style={{
          ...panelStyle,
          visibility: panelStyle ? 'visible' : 'hidden',
        }}
      >
        {items.map((item) => (
          <MenuEntry
            key={`${item.kind}-${'label' in item ? item.label : ''}`}
            item={item}
            onClose={() => setOpen(false)}
          />
        ))}
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
