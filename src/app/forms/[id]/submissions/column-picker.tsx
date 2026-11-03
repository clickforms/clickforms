'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/toast';
import './column-picker.css';

interface ColumnPickerProps {
  formId: string;
  /** Current column heading. */
  label: string;
  fields: { id: string; label: string }[];
  /** Currently chosen field id; null = automatic. */
  selectedId: string | null;
}

/**
 * The first column's header doubles as a field picker (like a Notion/Airtable property menu):
 * click the heading, search your form's fields, pick the one that identifies a response.
 */
export function ColumnPicker({ formId, label, fields, selectedId }: ColumnPickerProps) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // The table sits inside an overflow-scrolling wrapper that would clip an absolutely
  // positioned popover, so it's portalled to <body> and placed from the trigger's rect.
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const width = 320;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setCoords({ top: rect.bottom + 8, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    const close = () => setOpen(false);
    const closeOnOuterScroll = (event: Event) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', closeOnOuterScroll, true);
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', closeOnOuterScroll, true);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? fields.filter((f) => f.label.toLowerCase().includes(term)) : fields;
  }, [fields, query]);

  async function choose(fieldId: string | null) {
    if (fieldId === selectedId) {
      setOpen(false);
      return;
    }
    setPending(fieldId);
    setOpen(false);
    try {
      const res = await fetch(`/api/forms/${formId}/response-column`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId }),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Could not update the column.');
        return;
      }
      router.refresh();
    } catch {
      toast.error('Could not update the column.');
    } finally {
      setPending(undefined);
      setQuery('');
    }
  }

  const busy = pending !== undefined;

  return (
    <div className="column-picker" ref={rootRef}>
      <button
        type="button"
        className="column-picker-trigger"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        title="Choose what this column shows"
      >
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path
            d="M2 3.75 5 6.75l3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && coords
        ? createPortal(
            <div
              ref={popoverRef}
              className="column-picker-popover"
              style={{ top: coords.top, left: coords.left }}
              role="dialog"
              aria-label="Choose column field"
            >
              <div className="column-picker-head">
                <p className="column-picker-title">Show in this column</p>
                <p className="column-picker-sub">
                  Pick the field that identifies each response — a name, job number, site or
                  anything else on your form.
                </p>
              </div>
              <input
                ref={searchRef}
                type="text"
                className="column-picker-search"
                placeholder="Search fields"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search fields"
              />
              <ul className="column-picker-list">
                {!query ? (
                  <li>
                    <button
                      type="button"
                      aria-pressed={selectedId === null}
                      className="column-picker-option"
                      onClick={() => void choose(null)}
                    >
                      <span className="column-picker-option-text">
                        <strong>Automatic</strong>
                        <small>Name or email, if the form has one</small>
                      </span>
                      {selectedId === null ? <Check /> : null}
                    </button>
                  </li>
                ) : null}
                {visible.map((field) => (
                  <li key={field.id}>
                    <button
                      type="button"
                      aria-pressed={selectedId === field.id}
                      className="column-picker-option"
                      onClick={() => void choose(field.id)}
                    >
                      <span className="column-picker-option-text">
                        <strong>{field.label || 'Untitled field'}</strong>
                      </span>
                      {selectedId === field.id ? <Check /> : null}
                    </button>
                  </li>
                ))}
                {visible.length === 0 ? (
                  <li className="column-picker-empty">No matching fields</li>
                ) : null}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="m3 7.5 2.7 2.7L11 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
