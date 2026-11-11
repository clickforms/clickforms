'use client';

import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from 'react';
import { DayPicker, type Matcher } from 'react-day-picker';
import 'react-day-picker/style.css';
import './date-picker-field.css';
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
  const [month, setMonth] = useState<Date>(() => selected ?? new Date());
  const [typed, setTyped] = useState(displayValue);
  const [typedError, setTypedError] = useState(false);
  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);
  const nowYear = new Date().getFullYear();
  const startMonth = new Date(minDate ? minDate.getFullYear() : 1900, 0);
  const endMonth = new Date(maxDate ? maxDate.getFullYear() : nowYear + 20, 11);

  // Re-seed the typed box and visible month each time the popover opens or the value
  // changes from outside.
  useEffect(() => {
    if (!open) return;
    setTyped(formatIsoDateForDisplay(value));
    setTypedError(false);
    setMonth(parseIsoDate(value) ?? new Date());
  }, [open, value]);

  function formatTyping(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    return parts.join('/');
  }

  function commitTyped() {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(typed);
    if (!match) {
      setTypedError(typed.length > 0);
      return;
    }
    const day = Number(match[1]);
    const mon = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, mon - 1, day);
    const valid =
      date.getFullYear() === year && date.getMonth() === mon - 1 && date.getDate() === day;
    const inRange = (!minDate || date >= minDate) && (!maxDate || date <= maxDate);
    if (!valid || !inRange) {
      setTypedError(true);
      return;
    }
    onChange(toIsoDate(date));
    setOpen(false);
  }

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
          <div className="date-picker-typed">
            <input
              type="text"
              inputMode="numeric"
              className={`date-picker-typed-input${typedError ? ' date-picker-typed-input--error' : ''}`}
              placeholder="DD/MM/YYYY"
              aria-label="Type a date as DD/MM/YYYY"
              aria-invalid={typedError}
              value={typed}
              onChange={(event) => {
                setTyped(formatTyping(event.target.value));
                setTypedError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitTyped();
                }
              }}
              onBlur={() => {
                if (typed.length === 10) commitTyped();
              }}
            />
            {typedError ? (
              <span className="date-picker-typed-error" role="alert">
                Enter a valid date{minDate || maxDate ? ' in the allowed range' : ''}
              </span>
            ) : null}
          </div>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={disabledMatchers}
            month={month}
            onMonthChange={setMonth}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
          />
        </div>
      ) : null}
    </div>
  );
}
