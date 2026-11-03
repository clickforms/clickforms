'use client';

import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fires once, the moment the last digit is entered (typed or pasted). */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label: string;
}

/** Segmented one-time-code input: one box per digit, auto-advance, backspace goes back, paste
 * of a full code fills every box, and the first box carries autocomplete="one-time-code" so
 * browsers/phones can offer the code straight from the email or SMS. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  autoFocus,
  label,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  // After a failed attempt the parent clears the value — put the cursor back at the start.
  useEffect(() => {
    if (value === '' && !disabled) refs.current[0]?.focus();
  }, [value, disabled]);

  function commit(next: string) {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  }

  function handleChange(index: number, raw: string) {
    const entered = raw.replace(/\D/g, '');
    if (!entered) return;
    // Typing over a filled box, or a multi-character autofill, both land here.
    const next = (value.slice(0, index) + entered).slice(0, length);
    commit(next);
    refs.current[Math.min(next.length, length - 1)]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    commit(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <fieldset className="otp-input" aria-label={label}>
      {digits.map((digit, index) => (
        <input
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional boxes
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          className={`otp-input-box${invalid ? ' otp-input-box--invalid' : ''}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={index === 0 ? length : 1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </fieldset>
  );
}
