'use client';

import { useEffect, useState } from 'react';
import { normalizeHexColor } from '@/lib/forms/color';
import { FIELD_COLOR_PRESETS } from '@/lib/forms/schema';

interface FieldColorPickerProps {
  label: string;
  value: string | undefined;
  defaultColor: string;
  canEdit: boolean;
  onChange: (color: string | undefined) => void;
}

export function FieldColorPicker({
  label,
  value,
  defaultColor,
  canEdit,
  onChange,
}: FieldColorPickerProps) {
  const activeColor = value ?? defaultColor;
  const [hexInput, setHexInput] = useState(activeColor);
  const [hexError, setHexError] = useState<string | null>(null);

  useEffect(() => {
    setHexInput(activeColor);
    setHexError(null);
  }, [activeColor]);

  function commitHexInput() {
    const normalized = normalizeHexColor(hexInput);
    if (!normalized) {
      setHexError('Enter a hex color like #00a960');
      setHexInput(activeColor);
      return;
    }

    setHexError(null);
    setHexInput(normalized);

    const nextValue = normalized === defaultColor.toLowerCase() ? undefined : normalized;
    const currentValue = value?.toLowerCase();
    const normalizedCurrent = currentValue ?? defaultColor.toLowerCase();
    if (normalized === normalizedCurrent) {
      return;
    }

    onChange(nextValue);
  }

  return (
    <div className="field-color-picker">
      <p className="field-color-picker-label">{label}</p>
      <ul className="field-color-presets" aria-label={`${label} presets`}>
        {FIELD_COLOR_PRESETS.map((color) => (
          <li key={color}>
            <button
              type="button"
              className={`field-color-swatch ${activeColor.toLowerCase() === color.toLowerCase() ? 'field-color-swatch--active' : ''}`}
              style={{ backgroundColor: color }}
              disabled={!canEdit}
              title={color}
              aria-label={color}
              onClick={() => onChange(color === defaultColor.toLowerCase() ? undefined : color)}
            />
          </li>
        ))}
      </ul>
      <div className="field-color-custom">
        <label className="field-color-custom-label">
          <span className="settings-label">Custom hex</span>
          <span
            className="field-color-preview"
            style={{ backgroundColor: activeColor }}
            aria-hidden
          />
          <input
            type="text"
            className="text-input field-color-hex-input"
            value={hexInput}
            placeholder="#00a960"
            spellCheck={false}
            disabled={!canEdit}
            onChange={(event) => {
              setHexInput(event.target.value);
              setHexError(null);
            }}
            onBlur={commitHexInput}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitHexInput();
              }
            }}
          />
        </label>
        {value ? (
          <button
            type="button"
            className="button button--ghost button--small"
            disabled={!canEdit}
            onClick={() => onChange(undefined)}
          >
            Reset
          </button>
        ) : null}
      </div>
      {hexError ? <p className="field-color-hex-error">{hexError}</p> : null}
    </div>
  );
}
