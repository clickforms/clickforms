'use client';

import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from 'react';
import { DayPicker, type Matcher } from 'react-day-picker';
import 'react-day-picker/style.css';
import { formatIsoDateForDisplay, parseIsoDate, toIsoDate } from '@/lib/forms/date-value';

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
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

interface DatePickerFieldProps {
  id: string;
  value: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  onChange: (value: string) => void;
}

export function DatePickerField({
  id,
  value,
  min,
  max,
  disabled = false,
  placeholder = 'Select date…',
  className = '',
  style,
  onChange,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseIsoDate(value);

  const disabledMatchers = useMemo(() => {
    const matchers: Matcher[] = [];
    const minDate = parseIsoDate(min);
    const maxDate = parseIsoDate(max);
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [min, max]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const displayValue = formatIsoDateForDisplay(value);

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    onChange(toIsoDate(date));
    setOpen(false);
  }

  return (
    <div className="date-picker-field" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`date-picker-trigger ${className}`.trim()}
        style={style}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        <span className={displayValue ? 'date-picker-value' : 'date-picker-placeholder'}>
          {displayValue || placeholder}
        </span>
        <CalendarIcon />
      </button>

      {open ? (
        <div className="date-picker-popover" id={popoverId} role="dialog" aria-label="Choose date">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={disabledMatchers}
            defaultMonth={selected}
          />
        </div>
      ) : null}
    </div>
  );
}
