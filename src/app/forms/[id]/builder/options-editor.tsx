'use client';

import type { FieldOption } from '@/lib/forms/schema';

interface OptionsEditorProps {
  options: FieldOption[];
  canEdit: boolean;
  onChange: (options: FieldOption[]) => void;
}

export function OptionsEditor({ options, canEdit, onChange }: OptionsEditorProps) {
  function updateLabel(index: number, label: string) {
    onChange(options.map((option, i) => (i === index ? { ...option, label } : option)));
  }

  function removeOption(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function addOption() {
    onChange([...options, { id: crypto.randomUUID(), label: `Option ${options.length + 1}` }]);
  }

  function moveOption(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    // Swap — both `index` and `target` are bounds-checked above, so these reads/writes
    // are safe despite noUncheckedIndexedAccess treating array access as possibly-undefined.
    const current = next[index] as FieldOption;
    const swapped = next[target] as FieldOption;
    next[index] = swapped;
    next[target] = current;
    onChange(next);
  }

  return (
    <div className="options-editor">
      {options.map((option, index) => (
        <div key={option.id} className="options-editor-row">
          <input
            className="text-input"
            value={option.label}
            disabled={!canEdit}
            onChange={(event) => updateLabel(index, event.target.value)}
          />
          {canEdit && (
            <div className="options-editor-controls">
              <button
                type="button"
                className="page-tab-move"
                disabled={index === 0}
                onClick={() => moveOption(index, -1)}
                aria-label="Move option up"
              >
                &uarr;
              </button>
              <button
                type="button"
                className="page-tab-move"
                disabled={index === options.length - 1}
                onClick={() => moveOption(index, 1)}
                aria-label="Move option down"
              >
                &darr;
              </button>
              <button
                type="button"
                className="options-editor-remove"
                disabled={options.length <= 1}
                onClick={() => removeOption(index)}
                aria-label="Remove option"
              >
                &times;
              </button>
            </div>
          )}
        </div>
      ))}
      {canEdit && (
        <button type="button" className="button button--ghost button--small" onClick={addOption}>
          + Add option
        </button>
      )}
    </div>
  );
}
