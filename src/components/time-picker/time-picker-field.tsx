'use client';

import { type CSSProperties, useEffect, useId, useRef, useState } from 'react';
import { formatTimeForDisplay, parseTimeValue, toTimeValue } from '@/lib/forms/time-value';

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M9 5.5V9l2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

interface TimePickerFieldProps {
  id: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  onChange: (value: string) => void;
}

export function TimePickerField({
  id,
  value,
  disabled = false,
  placeholder = 'Select time…',
  className = '',
  style,
  onChange,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  const parsed = parseTimeValue(value);
  const selectedHour = parsed?.hours ?? null;
  const selectedMinute = parsed?.minutes ?? null;

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

  useEffect(() => {
    if (!open) return;

    const hourButton = hourListRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    const minuteButton =
      minuteListRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    hourButton?.scrollIntoView({ block: 'center' });
    minuteButton?.scrollIntoView({ block: 'center' });
  }, [open]);

  const displayValue = formatTimeForDisplay(value);

  function selectHour(hours: number) {
    const minutes = selectedMinute ?? 0;
    onChange(toTimeValue(hours, minutes));
  }

  function selectMinute(minutes: number) {
    const hours = selectedHour ?? 0;
    onChange(toTimeValue(hours, minutes));
  }

  return (
    <div className="time-picker-field" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`time-picker-trigger ${className}`.trim()}
        style={style}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        <span className={displayValue ? 'time-picker-value' : 'time-picker-placeholder'}>
          {displayValue || placeholder}
        </span>
        <ClockIcon />
      </button>

      {open ? (
        <div className="time-picker-popover" id={popoverId} role="dialog" aria-label="Choose time">
          <div className="time-picker-columns">
            <div className="time-picker-column" ref={hourListRef} role="listbox" aria-label="Hour">
              {HOURS.map((hour) => {
                const selected = selectedHour === hour;
                return (
                  <button
                    key={hour}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-selected={selected ? 'true' : undefined}
                    className={`time-picker-option ${selected ? 'time-picker-option--selected' : ''}`}
                    onClick={() => selectHour(hour)}
                  >
                    {String(hour).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
            <div
              className="time-picker-column"
              ref={minuteListRef}
              role="listbox"
              aria-label="Minute"
            >
              {MINUTES.map((minute) => {
                const selected = selectedMinute === minute;
                return (
                  <button
                    key={minute}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-selected={selected ? 'true' : undefined}
                    className={`time-picker-option ${selected ? 'time-picker-option--selected' : ''}`}
                    onClick={() => selectMinute(minute)}
                  >
                    {String(minute).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="time-picker-footer">
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="button button--small"
              onClick={() => setOpen(false)}
              disabled={selectedHour === null || selectedMinute === null}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
