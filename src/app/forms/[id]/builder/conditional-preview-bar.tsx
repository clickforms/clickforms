'use client';

import { useState } from 'react';
import type { FormAnswers } from '@/lib/forms/conditional-logic';
import type { FormSchema } from '@/lib/forms/schema';

interface ConditionalPreviewBarProps {
  schema: FormSchema;
  mockAnswers: FormAnswers;
  onChangeAnswer: (fieldId: string, value: string | string[] | undefined) => void;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`conditional-preview-chevron ${expanded ? 'conditional-preview-chevron--expanded' : ''}`}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ConditionalPreviewBar({
  schema,
  mockAnswers,
  onChangeAnswer,
}: ConditionalPreviewBarProps) {
  const [expanded, setExpanded] = useState(false);
  const triggerFieldIds = Array.from(
    new Set(schema.conditionalLogic.map((rule) => rule.showIf.fieldId)),
  );
  if (triggerFieldIds.length === 0) return null;

  return (
    <div
      className={`conditional-preview-bar ${expanded ? 'conditional-preview-bar--expanded' : ''}`}
    >
      <button
        type="button"
        className="conditional-preview-toggle"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="conditional-preview-toggle-label">Conditional preview</span>
        <span className="conditional-preview-toggle-meta">
          {triggerFieldIds.length} trigger{triggerFieldIds.length === 1 ? '' : 's'}
        </span>
        <ChevronIcon expanded={expanded} />
      </button>

      {expanded ? (
        <>
          <p className="conditional-preview-hint">
            Simulate answers to preview which fields show or hide.
          </p>
          <div className="conditional-preview-controls">
            {triggerFieldIds.map((fieldId) => {
              const field = schema.fields[fieldId];
              if (!field) return null;

              if (field.type === 'checkbox') {
                const current = Array.isArray(mockAnswers[fieldId])
                  ? (mockAnswers[fieldId] as string[])
                  : [];
                return (
                  <div key={fieldId} className="conditional-preview-control">
                    <span className="settings-label">{field.label || 'Untitled field'}</span>
                    <div className="field-preview-options conditional-preview-options">
                      {field.options.map((option) => (
                        <label
                          key={option.id}
                          className="field-preview-option conditional-preview-option"
                        >
                          <input
                            type="checkbox"
                            checked={current.includes(option.id)}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...current, option.id]
                                : current.filter((value) => value !== option.id);
                              onChangeAnswer(fieldId, next);
                            }}
                          />
                          <span>{option.label || 'Untitled option'}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }

              if ('options' in field) {
                const currentValue =
                  typeof mockAnswers[fieldId] === 'string' ? (mockAnswers[fieldId] as string) : '';
                return (
                  <label key={fieldId} className="conditional-preview-control">
                    <span className="settings-label">{field.label || 'Untitled field'}</span>
                    <select
                      className="text-input"
                      value={currentValue}
                      onChange={(event) => onChangeAnswer(fieldId, event.target.value || undefined)}
                    >
                      <option value="">Not answered</option>
                      {field.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label || 'Untitled option'}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              const currentValue =
                typeof mockAnswers[fieldId] === 'string' ? (mockAnswers[fieldId] as string) : '';
              return (
                <label key={fieldId} className="conditional-preview-control">
                  <span className="settings-label">{field.label || 'Untitled field'}</span>
                  <input
                    className="text-input"
                    type={field.type === 'date' ? 'date' : 'text'}
                    value={currentValue}
                    onChange={(event) => onChangeAnswer(fieldId, event.target.value || undefined)}
                  />
                </label>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
