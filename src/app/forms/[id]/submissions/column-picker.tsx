'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
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

      {open ? (
        <div className="column-picker-popover" role="dialog" aria-label="Choose column field">
          <div className="column-picker-head">
            <p className="column-picker-title">Show in this column</p>
            <p className="column-picker-sub">
              Pick the field that identifies each response — a name, job number, site or anything
              else on your form.
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
        </div>
      ) : null}
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
