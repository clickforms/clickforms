'use client';

import type { ReactNode, RefObject } from 'react';
import '@/components/list-filters/list-filters.css';
import { DropdownMenu } from '@/components/dropdown-menu';

/** A solid-looking funnel: lightly filled with a firm outline, so it reads as "filter". */
export function FunnelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.4 3.6a.6.6 0 0 1 .6-.6h12a.6.6 0 0 1 .46.98L11 9.4v4.3a.6.6 0 0 1-.33.54l-2.4 1.2a.6.6 0 0 1-.87-.54V9.4L2.54 3.98a.6.6 0 0 1-.14-.38Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <path d="m1 1 6 6M7 1 1 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="m2.5 6.3 2.4 2.4 4.6-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Labelled "Filter" pill with the funnel icon; turns green with a count badge when filters apply. */
export function FilterButton({
  buttonRef,
  appliedCount,
  open,
  onClick,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  appliedCount: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`lf-btn${appliedCount > 0 ? ' lf-btn--active' : ''}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={appliedCount > 0 ? `Filter, ${appliedCount} applied` : 'Filter'}
      onClick={onClick}
    >
      <FunnelIcon />
      <span>Filter</span>
      {appliedCount > 0 ? <span className="lf-badge">{appliedCount}</span> : null}
    </button>
  );
}

/** The popover that opens from FilterButton. Put FilterGroups inside. */
export function FilterPanel({
  open,
  onOpenChange,
  triggerRef,
  onClear,
  canClear,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClear: () => void;
  canClear: boolean;
  children: ReactNode;
}) {
  return (
    <DropdownMenu
      open={open}
      onOpenChange={onOpenChange}
      triggerRef={triggerRef}
      align="start"
      panelClassName="actions-menu-panel lf-panel"
    >
      <div className="lf-panel-head">
        <h3>Filter</h3>
        <button type="button" className="lf-clear" disabled={!canClear} onClick={onClear}>
          Clear
        </button>
      </div>
      {children}
    </DropdownMenu>
  );
}

export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="lf-group">
      <p className="lf-group-label">{label}</p>
      <div className="lf-options">{children}</div>
    </div>
  );
}

export function FilterOption({
  selected,
  count,
  onClick,
  children,
}: {
  selected: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="lf-option" aria-pressed={selected} onClick={onClick}>
      {selected ? <CheckGlyph /> : null}
      {children}
      {count !== undefined ? <span className="lf-option-count">{count}</span> : null}
    </button>
  );
}

/** "Showing: Status: Sent ×  Search: "x" ×  Clear all" row under the toolbar. */
export function AppliedFilters({
  chips,
  onClearAll,
}: {
  chips: { key: string; label: string; onRemove: () => void }[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="lf-applied">
      <span className="lf-applied-label">Showing</span>
      {chips.map((chip) => (
        <span key={chip.key} className="lf-chip">
          {chip.label}
          <button type="button" aria-label={`Remove filter: ${chip.label}`} onClick={chip.onRemove}>
            <CloseGlyph />
          </button>
        </span>
      ))}
      <button type="button" className="lf-applied-clear" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
