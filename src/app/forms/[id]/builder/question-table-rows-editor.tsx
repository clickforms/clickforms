'use client';

import { OptionsEditor } from '@/app/forms/[id]/builder/options-editor';
import {
  QUESTION_ROW_ANSWER_TYPE_LABEL,
  QUESTION_ROW_ANSWER_TYPES,
  type QuestionRowAnswerType,
  type QuestionTableRow,
} from '@/lib/forms/schema';

interface QuestionTableRowsEditorProps {
  rows: QuestionTableRow[];
  canEdit: boolean;
  onChange: (rows: QuestionTableRow[]) => void;
}

/** Row editor for the `question_table` field type's Content settings — one row per
 * question with a label, an answer-type picker (short_text/number/dropdown/date), a
 * per-row required toggle (see the schema comment on questionTableRowSchema.required for
 * why this lives per-row instead of using the field-level Required toggle), and — only
 * for dropdown rows — a nested OptionsEditor for that row's own option list. Modeled
 * directly on TableColumnsEditor, swapping "column" for "row" and adding the required
 * toggle columns don't need. */
export function QuestionTableRowsEditor({ rows, canEdit, onChange }: QuestionTableRowsEditorProps) {
  function updateRow(index: number, patch: Partial<QuestionTableRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function setRowType(index: number, type: QuestionRowAnswerType) {
    const row = rows[index];
    if (!row) return;
    // Switching to dropdown seeds two starter options so the field isn't left with an
    // empty picker; switching away leaves any previously-entered options in place
    // (undisturbed by updateRow's shallow merge) in case the admin switches back.
    if (type === 'dropdown' && (!row.options || row.options.length === 0)) {
      updateRow(index, {
        type,
        options: [
          { id: crypto.randomUUID(), label: 'Option 1' },
          { id: crypto.randomUUID(), label: 'Option 2' },
        ],
      });
      return;
    }
    updateRow(index, { type });
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([
      ...rows,
      {
        id: crypto.randomUUID(),
        label: `Question ${rows.length + 1}`,
        type: 'short_text',
        required: true,
      },
    ]);
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const current = next[index] as QuestionTableRow;
    const swapped = next[target] as QuestionTableRow;
    next[index] = swapped;
    next[target] = current;
    onChange(next);
  }

  return (
    <div className="table-columns-editor">
      {rows.map((row, index) => (
        <div key={row.id} className="table-columns-editor-row">
          <div className="table-columns-editor-row-main">
            <input
              className="text-input"
              value={row.label}
              disabled={!canEdit}
              placeholder="Question"
              onChange={(event) => updateRow(index, { label: event.target.value })}
            />
            <div className="table-columns-editor-row-meta">
              <select
                className="text-input"
                value={row.type}
                disabled={!canEdit}
                onChange={(event) => setRowType(index, event.target.value as QuestionRowAnswerType)}
              >
                {QUESTION_ROW_ANSWER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {QUESTION_ROW_ANSWER_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
              {canEdit && (
                <div className="options-editor-controls">
                  <button
                    type="button"
                    className="page-tab-move"
                    disabled={index === 0}
                    onClick={() => moveRow(index, -1)}
                    aria-label="Move question up"
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    className="page-tab-move"
                    disabled={index === rows.length - 1}
                    onClick={() => moveRow(index, 1)}
                    aria-label="Move question down"
                  >
                    &darr;
                  </button>
                  <button
                    type="button"
                    className="options-editor-remove"
                    disabled={rows.length <= 1}
                    onClick={() => removeRow(index)}
                    aria-label="Remove question"
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>
          </div>
          <label className="settings-toggle-row settings-toggle-row--compact">
            <span className="settings-label">Required</span>
            <input
              type="checkbox"
              checked={row.required ?? false}
              disabled={!canEdit}
              onChange={(event) => updateRow(index, { required: event.target.checked })}
            />
          </label>
          {row.type === 'dropdown' ? (
            <div className="table-columns-editor-dropdown-options">
              <OptionsEditor
                options={row.options ?? []}
                canEdit={canEdit}
                onChange={(options) => updateRow(index, { options })}
              />
            </div>
          ) : null}
        </div>
      ))}
      {canEdit && (
        <button type="button" className="button button--ghost button--small" onClick={addRow}>
          + Add question
        </button>
      )}
    </div>
  );
}
