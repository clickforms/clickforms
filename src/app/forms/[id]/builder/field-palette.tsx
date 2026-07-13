'use client';

import { useDraggable } from '@dnd-kit/core';
import { COLUMN_LAYOUT_LABELS, FIELD_TYPE_LABELS } from '@/app/forms/[id]/builder/field-meta';
import type { ColumnCount, FieldType } from '@/lib/forms/schema';

function PaletteIcon({ type }: { type: FieldType }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 18 18',
    fill: 'none',
    'aria-hidden': true,
  } as const;
  switch (type) {
    case 'short_text':
      return (
        <svg {...common} aria-hidden="true">
          <line
            x1="2"
            y1="9"
            x2="16"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'paragraph':
      return (
        <svg {...common} aria-hidden="true">
          <line
            x1="2"
            y1="5"
            x2="16"
            y2="5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="9"
            x2="16"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="13"
            x2="11"
            y2="13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'multi_choice':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="5" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="5" cy="9" r="1.1" fill="currentColor" />
          <line
            x1="10.5"
            y1="9"
            x2="16"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'checkbox':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2"
            y="5.5"
            width="7"
            height="7"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M3.6 9.2l1.5 1.5 2.6-3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="11.5"
            y1="9"
            x2="16"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'dropdown':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="2" y="5" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M6.5 9l2 2 2-2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'date':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2"
            y="4"
            width="14"
            height="11"
            rx="1.8"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line x1="2" y1="7.5" x2="16" y2="7.5" stroke="currentColor" strokeWidth="1.5" />
          <line
            x1="5.5"
            y1="2.5"
            x2="5.5"
            y2="5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="12.5"
            y1="2.5"
            x2="12.5"
            y2="5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'time':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M9 5.5V9l2.5 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'email':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2"
            y="5"
            width="14"
            height="9"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M2 6.5l7 4.5 7-4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'file_upload':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M9 12V3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M5.5 7L9 3.5 12.5 7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 12v1.5A1.5 1.5 0 0 0 4.5 15h9a1.5 1.5 0 0 0 1.5-1.5V12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'signature':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M2 12c1.5-4 2.5-6 3.5-6s1 3 2 3 1.5-4.5 3-4.5 1 6 2.5 6 1.5-2.5 3-2.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'section_break':
      return (
        <svg {...common} aria-hidden="true">
          <line
            x1="2"
            y1="6"
            x2="16"
            y2="6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="12"
            x2="16"
            y2="12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="9"
            y1="4"
            x2="9"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'column_layout':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2"
            y="4"
            width="5.5"
            height="10"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <rect
            x="6.25"
            y="4"
            width="5.5"
            height="10"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <rect
            x="10.5"
            y="4"
            width="5.5"
            height="10"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      );
    case 'static_text':
      return (
        <svg {...common} aria-hidden="true">
          <line
            x1="2"
            y1="5"
            x2="16"
            y2="5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="9"
            x2="16"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="13"
            x2="13"
            y2="13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'image':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2.5"
            y="3.5"
            width="13"
            height="11"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="6.5" cy="7.5" r="1.5" fill="currentColor" />
          <path
            d="M2.5 12.5l3.5-3.5 2.5 2.5 2-2 4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'address':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M9 15.5s5.5-4.8 5.5-9A5.5 5.5 0 0 0 3.5 6.5c0 4.2 5.5 9 5.5 9Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'choice_matrix':
      return (
        <svg {...common} aria-hidden="true">
          <line
            x1="2"
            y1="4.5"
            x2="16"
            y2="4.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="6.5" cy="9" r="1.2" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="11.5" cy="9" r="1.2" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="6.5" cy="13.5" r="1.2" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="11.5" cy="13.5" r="1.2" fill="currentColor" />
          <line
            x1="2"
            y1="9"
            x2="3.6"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="13.5"
            x2="3.6"
            y2="13.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

/** Six-dot drag-handle glyph shown at the right edge of every palette item — a purely
 * decorative affordance (the whole button is draggable via useDraggable, not just this
 * icon) that signals "this is draggable" the way a typical builder palette does. */
function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden="true">
      {[2.5, 7.5, 12.5].map((y) =>
        [2, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.15" fill="currentColor" />),
      )}
    </svg>
  );
}

function PaletteButton({ type, onAdd }: { type: FieldType; onAdd: (type: FieldType) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: 'palette', fieldType: type },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`palette-item ${isDragging ? 'palette-item--dragging' : ''}`}
      style={style}
      onClick={() => onAdd(type)}
      {...attributes}
      {...listeners}
    >
      <span className="palette-item-icon">
        <PaletteIcon type={type} />
      </span>
      <span className="palette-item-label">{FIELD_TYPE_LABELS[type]}</span>
      <span className="palette-item-grip">
        <GripIcon />
      </span>
    </button>
  );
}

function ColumnLayoutButton({
  columns,
  onAdd,
}: {
  columns: ColumnCount;
  onAdd: (columns: ColumnCount) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette:columns:${columns}`,
    data: { source: 'palette', columnLayoutColumns: columns },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`palette-item ${isDragging ? 'palette-item--dragging' : ''}`}
      style={style}
      onClick={() => onAdd(columns)}
      {...attributes}
      {...listeners}
    >
      <span className="palette-item-icon">
        <PaletteIcon type="column_layout" />
      </span>
      <span className="palette-item-label">{COLUMN_LAYOUT_LABELS[columns]}</span>
      <span className="palette-item-grip">
        <GripIcon />
      </span>
    </button>
  );
}

export function FieldPalette({
  onAddField,
  onAddColumnLayout,
}: {
  onAddField: (type: FieldType) => void;
  onAddColumnLayout: (columns: ColumnCount) => void;
}) {
  const groups: { label: string; types: FieldType[] }[] = [
    { label: 'Text', types: ['short_text', 'paragraph', 'email', 'address'] },
    { label: 'Choice', types: ['multi_choice', 'checkbox', 'dropdown', 'choice_matrix'] },
    { label: 'Date & time', types: ['date', 'time'] },
    { label: 'Files & sign', types: ['file_upload', 'signature'] },
    { label: 'Layout', types: ['section_break', 'static_text', 'image'] },
  ];

  const columnCounts: ColumnCount[] = [2, 3, 4];

  return (
    <div className="field-palette">
      <p className="field-palette-title">Fields</p>
      <div className="palette-groups">
        {groups.map((group) => (
          <div key={group.label} className="palette-group">
            <p className="palette-group-label">{group.label}</p>
            <div className="palette-list">
              {group.types.map((type) => (
                <PaletteButton key={type} type={type} onAdd={onAddField} />
              ))}
              {group.label === 'Layout'
                ? columnCounts.map((columns) => (
                    <ColumnLayoutButton key={columns} columns={columns} onAdd={onAddColumnLayout} />
                  ))
                : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
