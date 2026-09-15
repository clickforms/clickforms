'use client';

import { type CSSProperties, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { type DateRange, DayPicker } from 'react-day-picker';
import { createPortal } from 'react-dom';
import 'react-day-picker/style.css';
import { parseIsoDate, toIsoDate } from '@/lib/forms/date-value';

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect
        x="2.5"
        y="3.5"
        width="13"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M2.5 7h13M6 2.5v2.5M12 2.5v2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface SubmissionsDateRangeValue {
  from: string | null;
  to: string | null;
}

function computePopoverStyle(trigger: HTMLElement, panel: HTMLElement): CSSProperties {
  const triggerRect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const gap = 8;
  const viewportPadding = 8;

  let top = triggerRect.bottom + gap;
  if (top + panelRect.height > window.innerHeight - viewportPadding) {
    const aboveTop = triggerRect.top - panelRect.height - gap;
    top = aboveTop >= viewportPadding ? aboveTop : viewportPadding;
  }

  let left = triggerRect.left;
  left = Math.max(
    viewportPadding,
    Math.min(left, window.innerWidth - panelRect.width - viewportPadding),
  );

  return { position: 'fixed', top, left };
}

// "Jul 1 – Jul 31, 2026" — the year is only shown once, on the end date, matching how a
// respondent would naturally read a range rather than repeating it on both ends.
function formatRangeLabel(value: SubmissionsDateRangeValue): string {
  const fromDate = parseIsoDate(value.from ?? undefined);
  const toDate = parseIsoDate(value.to ?? undefined);
  if (!fromDate && !toDate) return 'All time';

  const short = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const long = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (fromDate && toDate) return `${short(fromDate)} – ${long(toDate)}`;
  if (fromDate) return `From ${long(fromDate)}`;
  if (toDate) return `Until ${long(toDate)}`;
  return 'All time';
}

// Mirrors src/components/date-picker/date-picker-field.tsx (same hand-rolled
// relative/absolute popover + outside-click/Escape pattern), but in DayPicker's "range"
// mode and styled to match the Responses toolbar rather than a form field.
export function SubmissionsDateRangePicker({
  value,
  onChange,
}: {
  value: SubmissionsDateRangeValue;
  onChange: (value: SubmissionsDateRangeValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    setPanelStyle(computePopoverStyle(triggerRef.current, panelRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function reposition() {
      if (!triggerRef.current || !panelRef.current) return;
      setPanelStyle(computePopoverStyle(triggerRef.current, panelRef.current));
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
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

  const selected: DateRange | undefined =
    value.from || value.to
      ? { from: parseIsoDate(value.from ?? undefined), to: parseIsoDate(value.to ?? undefined) }
      : undefined;

  function handleSelect(range: DateRange | undefined) {
    onChange({
      from: range?.from ? toIsoDate(range.from) : null,
      to: range?.to ? toIsoDate(range.to) : null,
    });
  }

  const hasValue = Boolean(value.from || value.to);

  return (
    <div className="submissions-date-range" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="submissions-date-range-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="submissions-date-range-icon">
          <CalendarIcon />
        </span>
        {formatRangeLabel(value)}
        <span className="submissions-date-range-chevron">
          <ChevronDownIcon />
        </span>
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              className="submissions-date-range-popover"
              id={popoverId}
              role="dialog"
              aria-label="Filter by date"
              style={{ ...panelStyle, visibility: panelStyle ? 'visible' : 'hidden' }}
            >
              <DayPicker
                mode="range"
                selected={selected}
                onSelect={handleSelect}
                defaultMonth={selected?.from ?? new Date()}
              />
              <div className="submissions-date-range-actions">
                <button
                  type="button"
                  className="submissions-date-range-clear"
                  onClick={() => onChange({ from: null, to: null })}
                  disabled={!hasValue}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="button button--small"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
