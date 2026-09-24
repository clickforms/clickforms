'use client';

import { useDraggable } from '@dnd-kit/core';
import { useState } from 'react';
import { COLUMN_LAYOUT_LABELS, FIELD_TYPE_LABELS } from '@/app/forms/[id]/builder/field-meta';
import type { ColumnCount, FieldType } from '@/lib/forms/schema';

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Exported so the canvas empty-state's quick-add buttons (canvas.tsx) can show the same
 * icon as the matching palette entry, rather than duplicating this switch there. */
export function PaletteIcon({ type }: { type: FieldType }) {
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
    case 'divider':
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
            strokeDasharray="3 2.5"
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
    case 'number':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M5 3.5L4 14.5M13 3.5l-1 11M2.5 6.5h13M2 11.5h13"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M4 2.5h2.2l1 3-1.5 1.3a9 9 0 0 0 4.5 4.5l1.3-1.5 3 1v2.2c0 .9-.75 1.6-1.65 1.5C7.9 14 4 10.1 3.5 5.15A1.5 1.5 0 0 1 5 3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'website':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4" />
          <ellipse cx="9" cy="9" rx="2.8" ry="6.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="2.5" y1="9" x2="15.5" y2="9" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    case 'rating':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M9 2.7l1.8 3.65 4 .58-2.9 2.83.68 4-3.58-1.88-3.58 1.88.68-4-2.9-2.83 4-.58L9 2.7Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'opinion_scale':
      return (
        <svg {...common} aria-hidden="true">
          <line
            x1="2"
            y1="9"
            x2="16"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          {[2, 5.5, 9, 12.5, 16].map((x) => (
            <line
              key={x}
              x1={x}
              y1="6.5"
              x2={x}
              y2="11.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          ))}
          <circle cx="9" cy="9" r="2.2" fill="currentColor" />
        </svg>
      );
    case 'legal':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2"
            y="3"
            width="14"
            height="12"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M4.8 6.5h8.4M4.8 9h8.4M4.8 11.5h5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle
            cx="13.2"
            cy="12.8"
            r="3"
            fill="var(--color-surface, #fff)"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M11.9 12.8l.9.9 1.6-1.8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'hidden':
      return (
        <svg {...common} aria-hidden="true">
          <path
            d="M2.5 9S5 4.5 9 4.5 15.5 9 15.5 9 13 13.5 9 13.5 2.5 9 2.5 9Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.3" />
          <line
            x1="3"
            y1="15"
            x2="15"
            y2="3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'table':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2.5"
            y="3.5"
            width="13"
            height="11"
            rx="1.2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line x1="2.5" y1="7" x2="15.5" y2="7" stroke="currentColor" strokeWidth="1.3" />
          <line x1="7.3" y1="7" x2="7.3" y2="14.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="11.6" y1="7" x2="11.6" y2="14.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    case 'question_table':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2.5"
            y="3.5"
            width="13"
            height="11"
            rx="1.2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line x1="2.5" y1="7.5" x2="15.5" y2="7.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="7.6" y1="3.5" x2="7.6" y2="14.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    case 'full_name':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="9" cy="5.7" r="2.7" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M3.2 15.3c0-3 2.6-5.1 5.8-5.1s5.8 2.1 5.8 5.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'yes_no':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2"
            y="6"
            width="6.2"
            height="6.2"
            rx="1.4"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M3.6 9.1l1.3 1.3 2.1-2.4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="9.8"
            y="6"
            width="6.2"
            height="6.2"
            rx="1.4"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M11.5 7.7l2.8 2.6M14.3 7.7l-2.8 2.6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'ranking':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="3.5" cy="4.5" r="1.3" fill="currentColor" />
          <line
            x1="6.3"
            y1="4.5"
            x2="15.5"
            y2="4.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="3.5" cy="9" r="1.3" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <line
            x1="6.3"
            y1="9"
            x2="15.5"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="3.5" cy="13.5" r="1.3" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <line
            x1="6.3"
            y1="13.5"
            x2="15.5"
            y2="13.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'picture_choice':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2"
            y="3"
            width="6.4"
            height="6.4"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="4.2" cy="5.2" r="0.8" fill="currentColor" />
          <path
            d="M2.6 8.6l1.6-1.8 1.3 1.2 1.7-2 1.6 2.6"
            stroke="currentColor"
            strokeWidth="1.1"
            fill="none"
            strokeLinejoin="round"
          />
          <rect
            x="9.6"
            y="3"
            width="6.4"
            height="6.4"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="11.8" cy="5.2" r="0.8" fill="currentColor" />
          <path
            d="M10.2 8.6l1.6-1.8 1.3 1.2 1.7-2 1.6 2.6"
            stroke="currentColor"
            strokeWidth="1.1"
            fill="none"
            strokeLinejoin="round"
          />
          <circle cx="14.4" cy="10.4" r="2.4" fill="currentColor" />
          <path
            d="M13.3 10.4l0.75 0.75L15.6 9.5"
            stroke="var(--color-surface, #fff)"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'masked_text':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2"
            y="6"
            width="14"
            height="6"
            rx="1.2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line
            x1="4.5"
            y1="9"
            x2="4.5"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="7"
            y1="9"
            x2="7"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="9.5"
            y1="9"
            x2="9.5"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="12"
            y1="9"
            x2="13.5"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray="0.5 1.4"
          />
        </svg>
      );
    case 'calculation':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="3"
            y="2"
            width="12"
            height="14"
            rx="1.4"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line
            x1="5.5"
            y1="5.3"
            x2="12.5"
            y2="5.3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <line
            x1="5.7"
            y1="9"
            x2="7.3"
            y2="11"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <line
            x1="7.3"
            y1="9"
            x2="5.7"
            y2="11"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <line
            x1="9.5"
            y1="9"
            x2="12.5"
            y2="9"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <line
            x1="5.7"
            y1="13.3"
            x2="12.5"
            y2="13.3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'draw_on_image':
      return (
        <svg {...common} aria-hidden="true">
          <rect
            x="2"
            y="3"
            width="14"
            height="12"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="6" cy="7" r="1.3" fill="currentColor" />
          <path
            d="M2.5 13l3.5-3.5 2.5 2.5 2-2 3.5 3"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M11.5 8l3-3 1 1-3 3-1.4.4Z"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
            fill="var(--color-surface, #fff)"
          />
        </svg>
      );
    default:
      return null;
  }
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
      <span className={`palette-item-icon palette-item-icon--${paletteIconTone(type)}`}>
        <PaletteIcon type={type} />
      </span>
      <span className="palette-item-label">{FIELD_TYPE_LABELS[type]}</span>
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
      <span className="palette-item-icon palette-item-icon--media">
        <PaletteIcon type="column_layout" />
      </span>
      <span className="palette-item-label">{COLUMN_LAYOUT_LABELS[columns]}</span>
    </button>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={
        open ? 'palette-group-chevron palette-group-chevron--open' : 'palette-group-chevron'
      }
    >
      <path
        d="M3.5 5.5L7 9l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function paletteIconTone(type: FieldType): string {
  switch (type) {
    case 'date':
    case 'time':
      return 'date';
    case 'legal':
    case 'signature':
      return 'legal';
    case 'file_upload':
    case 'draw_on_image':
    case 'image':
    case 'section_break':
    case 'divider':
    case 'static_text':
    case 'hidden':
    case 'column_layout':
      return 'media';
    case 'rating':
    case 'opinion_scale':
      return 'rating';
    case 'multi_choice':
    case 'checkbox':
    case 'dropdown':
    case 'yes_no':
    case 'ranking':
    case 'picture_choice':
    case 'choice_matrix':
      return 'choice';
    default:
      return 'text';
  }
}

export function FieldPalette({
  onAddField,
  onAddColumnLayout,
}: {
  onAddField: (type: FieldType) => void;
  onAddColumnLayout: (columns: ColumnCount) => void;
}) {
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groups: { label: string; types: FieldType[] }[] = [
    {
      label: 'Text',
      types: [
        'full_name',
        'short_text',
        'paragraph',
        'email',
        'phone',
        'website',
        'number',
        'masked_text',
        'calculation',
        'address',
      ],
    },
    {
      label: 'Choice',
      types: [
        'multi_choice',
        'checkbox',
        'dropdown',
        'yes_no',
        'ranking',
        'picture_choice',
        'choice_matrix',
        'legal',
      ],
    },
    { label: 'Rating & scale', types: ['rating', 'opinion_scale'] },
    { label: 'Date & time', types: ['date', 'time'] },
    { label: 'Files & sign', types: ['file_upload', 'signature', 'draw_on_image'] },
    { label: 'Table', types: ['table', 'question_table'] },
    { label: 'Layout', types: ['section_break', 'divider', 'static_text', 'image', 'hidden'] },
  ];

  const columnCounts: ColumnCount[] = [2, 3, 4];
  const query = search.trim().toLowerCase();

  const filteredGroups = groups
    .map((group) => ({
      ...group,
      types: group.types.filter((type) => FIELD_TYPE_LABELS[type].toLowerCase().includes(query)),
      columnCounts:
        group.label === 'Layout'
          ? columnCounts.filter((columns) =>
              COLUMN_LAYOUT_LABELS[columns].toLowerCase().includes(query),
            )
          : [],
    }))
    .filter((group) => group.types.length > 0 || group.columnCounts.length > 0);

  return (
    <div className="field-palette">
      <h2 className="field-palette-title">Form fields</h2>
      <label className="palette-search">
        <span className="palette-search-icon">
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="palette-groups">
        {filteredGroups.map((group) => {
          const collapsed = !query && collapsedGroups[group.label] === true;
          return (
            <div key={group.label} className="palette-group">
              <button
                type="button"
                className="palette-group-toggle"
                onClick={() =>
                  setCollapsedGroups((prev) => ({ ...prev, [group.label]: !prev[group.label] }))
                }
                aria-expanded={!collapsed}
              >
                <span className="palette-group-label">{group.label}</span>
                <ChevronIcon open={!collapsed} />
              </button>
              {collapsed ? null : (
                <div className="palette-list">
                  {group.types.map((type) => (
                    <PaletteButton key={type} type={type} onAdd={onAddField} />
                  ))}
                  {group.columnCounts.map((columns) => (
                    <ColumnLayoutButton key={columns} columns={columns} onAdd={onAddColumnLayout} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filteredGroups.length === 0 ? (
          <p className="palette-empty">No fields match &ldquo;{search}&rdquo;.</p>
        ) : null}
      </div>
    </div>
  );
}
