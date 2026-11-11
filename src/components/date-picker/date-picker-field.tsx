'use client';

import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from 'react';
import { DayPicker, type Matcher } from 'react-day-picker';
import 'react-day-picker/style.css';
import './date-picker-field.css';
import { CalendarShell } from '@/components/calendar/calendar-shell';
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
  placeholder = 'DD/MM/YYYY',
  className = '',
  style,
  onChange,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseIsoDate(value);
  const displayValue = formatIsoDateForDisplay(value);
  const [month, setMonth] = useState<Date>(() => selected ?? new Date());
  const [typed, setTyped] = useState(displayValue);
  const [typedInvalid, setTypedInvalid] = useState(false);

  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);
  const nowYear = new Date().getFullYear();
  const startMonth = new Date(minDate ? minDate.getFullYear() : 1900, 0);
  const endMonth = new Date(maxDate ? maxDate.getFullYear() : nowYear + 20, 11);

  const disabledMatchers = useMemo(() => {
    const matchers: Matcher[] = [];
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [minDate, maxDate]);

  // Keep the typed text and visible month in step with the value when it changes from
  // outside (calendar pick, reset, prefill).
  useEffect(() => {
    setTyped(formatIsoDateForDisplay(value));
    setTypedInvalid(false);
    const next = parseIsoDate(value);
    if (next) setMonth(next);
  }, [value]);

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

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    onChange(toIsoDate(date));
    setOpen(false);
  }

  function formatTyping(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
  }

  function handleType(raw: string) {
    const text = formatTyping(raw);
    setTyped(text);
    if (text === '') {
      setTypedInvalid(false);
      if (value) onChange('');
      return;
    }
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    if (!match) {
      setTypedInvalid(false);
      return;
    }
    const day = Number(match[1]);
    const mon = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, mon - 1, day);
    const real =
      date.getFullYear() === year && date.getMonth() === mon - 1 && date.getDate() === day;
    const inRange = (!minDate || date >= minDate) && (!maxDate || date <= maxDate);
    if (!real || !inRange) {
      setTypedInvalid(true);
      return;
    }
    setTypedInvalid(false);
    setMonth(date);
    onChange(toIsoDate(date));
  }

  return (
    <div className="date-picker-field" ref={rootRef}>
      <input
        type="text"
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className={`date-picker-trigger date-picker-input ${className}`.trim()}
        style={style}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={typedInvalid || undefined}
        value={typed}
        onChange={(event) => handleType(event.target.value)}
        onBlur={() => {
          // An incomplete or out-of-range entry snaps back to the last valid value.
          setTyped(displayValue);
          setTypedInvalid(false);
        }}
      />
      <button
        type="button"
        className="date-picker-icon-button"
        disabled={disabled}
        aria-label="Open calendar"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        <CalendarIcon />
      </button>

      {open ? (
        <div className="date-picker-popover" id={popoverId} role="dialog" aria-label="Choose date">
          <CalendarShell
            month={month}
            onMonthChange={setMonth}
            startMonth={startMonth}
            endMonth={endMonth}
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              disabled={disabledMatchers}
              month={month}
              onMonthChange={setMonth}
              hideNavigation
              startMonth={startMonth}
              endMonth={endMonth}
            />
          </CalendarShell>
        </div>
      ) : null}
    </div>
  );
}
