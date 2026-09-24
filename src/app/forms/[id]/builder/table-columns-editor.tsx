'use client';

import { OptionsEditor } from '@/app/forms/[id]/builder/options-editor';
import {
  TABLE_COLUMN_TYPE_LABEL,
  TABLE_COLUMN_TYPES,
  type TableColumn,
  type TableColumnType,
} from '@/lib/forms/schema';

interface TableColumnsEditorProps {
  columns: TableColumn[];
  canEdit: boolean;
  onChange: (columns: TableColumn[]) => void;
}

/** Column editor for the `table` field type's Content settings — one row per column with
 * a label, a type picker (short_text/number/dropdown/date), and — only for dropdown
 * columns — a nested OptionsEditor for that column's own option list. Modeled on
 * OptionsEditor's move/remove/add chrome, extended with the extra per-column type field
 * choice_matrix's plain rows/columns don't need. */
export function TableColumnsEditor({ columns, canEdit, onChange }: TableColumnsEditorProps) {
  function updateColumn(index: number, patch: Partial<TableColumn>) {
    onChange(columns.map((column, i) => (i === index ? { ...column, ...patch } : column)));
  }

  function setColumnType(index: number, type: TableColumnType) {
    const column = columns[index];
    if (!column) return;
    // Switching to dropdown seeds two starter options (same shape OptionsEditor
    // expects) so the field isn't left with an empty picker; switching away leaves any
    // previously-entered options in place (undisturbed by updateColumn's shallow merge)
    // in case the admin switches back.
    if (type === 'dropdown' && (!column.options || column.options.length === 0)) {
      updateColumn(index, {
        type,
        options: [
          { id: crypto.randomUUID(), label: 'Option 1' },
          { id: crypto.randomUUID(), label: 'Option 2' },
        ],
      });
      return;
    }
    updateColumn(index, { type });
  }

  function removeColumn(index: number) {
    onChange(columns.filter((_, i) => i !== index));
  }

  function addColumn() {
    onChange([
      ...columns,
      {
        id: crypto.randomUUID(),
        label: `Column ${columns.length + 1}`,
        type: 'short_text',
      },
    ]);
  }

  function moveColumn(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    const current = next[index] as TableColumn;
    const swapped = next[target] as TableColumn;
    next[index] = swapped;
    next[target] = current;
    onChange(next);
  }

  return (
    <div className="table-columns-editor">
      {columns.map((column, index) => (
        <div key={column.id} className="table-columns-editor-row">
          <div className="table-columns-editor-row-main">
            <input
              className="text-input"
              value={column.label}
              disabled={!canEdit}
              placeholder="Column label"
              onChange={(event) => updateColumn(index, { label: event.target.value })}
            />
            <div className="table-columns-editor-row-meta">
              <select
                className="text-input"
                value={column.type}
                disabled={!canEdit}
                onChange={(event) => setColumnType(index, event.target.value as TableColumnType)}
              >
                {TABLE_COLUMN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TABLE_COLUMN_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
              {canEdit && (
                <div className="options-editor-controls">
                  <button
                    type="button"
                    className="page-tab-move"
                    disabled={index === 0}
                    onClick={() => moveColumn(index, -1)}
                    aria-label="Move column left"
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    className="page-tab-move"
                    disabled={index === columns.length - 1}
                    onClick={() => moveColumn(index, 1)}
                    aria-label="Move column right"
                  >
                    &darr;
                  </button>
                  <button
                    type="button"
                    className="options-editor-remove"
                    disabled={columns.length <= 1}
                    onClick={() => removeColumn(index)}
                    aria-label="Remove column"
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>
          </div>
          {column.type === 'dropdown' ? (
            <div className="table-columns-editor-dropdown-options">
              <OptionsEditor
                options={column.options ?? []}
                canEdit={canEdit}
                onChange={(options) => updateColumn(index, { options })}
              />
            </div>
          ) : null}
        </div>
      ))}
      {canEdit && (
        <button type="button" className="button button--ghost button--small" onClick={addColumn}>
          + Add column
        </button>
      )}
    </div>
  );
}
