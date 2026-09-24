'use client';

import type { PictureChoiceOption } from '@/lib/forms/schema';

interface PictureChoiceOptionsEditorProps {
  options: PictureChoiceOption[];
  canEdit: boolean;
  onChange: (options: PictureChoiceOption[]) => void;
}

// Same add/remove/reorder chrome as OptionsEditor (options-editor.tsx), plus a second
// "Image URL" input per row — picture_choice tiles carry an image alongside their label
// (see the schema comment on pictureChoiceOptionSchema for why that's a URL rather than
// an uploaded file like the `image` field type).
export function PictureChoiceOptionsEditor({
  options,
  canEdit,
  onChange,
}: PictureChoiceOptionsEditorProps) {
  function updateOption(index: number, patch: Partial<PictureChoiceOption>) {
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
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
    const current = next[index] as PictureChoiceOption;
    const swapped = next[target] as PictureChoiceOption;
    next[index] = swapped;
    next[target] = current;
    onChange(next);
  }

  return (
    <div className="options-editor picture-choice-options-editor">
      {options.map((option, index) => (
        <div key={option.id} className="options-editor-row picture-choice-options-editor-row">
          <div className="picture-choice-options-editor-fields">
            <input
              className="text-input"
              placeholder="Label"
              value={option.label}
              disabled={!canEdit}
              onChange={(event) => updateOption(index, { label: event.target.value })}
            />
            <input
              className="text-input"
              placeholder="Image URL (optional)"
              value={option.imageUrl ?? ''}
              disabled={!canEdit}
              onChange={(event) =>
                updateOption(index, { imageUrl: event.target.value || undefined })
              }
            />
          </div>
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
                disabled={options.length <= 2}
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
