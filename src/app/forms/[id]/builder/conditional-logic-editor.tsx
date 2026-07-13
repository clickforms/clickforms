'use client';

import { OPERATOR_LABELS, operatorsForTriggerType } from '@/app/forms/[id]/builder/field-meta';
import type {
  ConditionalRule,
  ConditionOperator,
  FieldOption,
  FormField,
  FormSchema,
} from '@/lib/forms/schema';
import { isLayoutOnlyField } from '@/lib/forms/schema';

interface ConditionalLogicEditorProps {
  schema: FormSchema;
  field: FormField;
  canEdit: boolean;
  onSetRule: (rule: ConditionalRule) => void;
  onClearRule: () => void;
}

// multi_choice/checkbox/dropdown are the only FormField union members with an `options`
// property — a plain `in` check is enough to narrow without re-deriving OPTION_FIELD_TYPES.
function isOptionField(field: FormField): field is FormField & { options: FieldOption[] } {
  return 'options' in field;
}

export function ConditionalLogicEditor({
  schema,
  field,
  canEdit,
  onSetRule,
  onClearRule,
}: ConditionalLogicEditorProps) {
  const existingRule = schema.conditionalLogic.find((rule) => rule.fieldId === field.id);
  const enabled = existingRule !== undefined;

  // Trigger candidates: any other field, excluding section_break (spec 02: "excluding
  // itself and any section_break" — section breaks are layout-only and never have an
  // answer to evaluate against).
  const candidateFields = Object.values(schema.fields).filter(
    (candidate) => candidate.id !== field.id && !isLayoutOnlyField(candidate.type),
  );

  function handleToggle(next: boolean) {
    if (!next) {
      onClearRule();
      return;
    }
    const firstCandidate = candidateFields[0];
    if (!firstCandidate) return;
    // operatorsForTriggerType always returns a non-empty array (see field-meta.ts), so
    // indexing [0] is safe despite noUncheckedIndexedAccess widening it to `| undefined`.
    const operator = operatorsForTriggerType(firstCandidate.type)[0] as ConditionOperator;
    const value = isOptionField(firstCandidate) ? (firstCandidate.options[0]?.id ?? '') : '';
    onSetRule({ fieldId: field.id, showIf: { fieldId: firstCandidate.id, operator, value } });
  }

  if (candidateFields.length === 0) {
    return (
      <div className="settings-section">
        <p className="settings-section-title">Show only if&hellip;</p>
        <p className="field-card-help">
          Add another field to this form first to create a condition.
        </p>
      </div>
    );
  }

  const triggerField = existingRule ? schema.fields[existingRule.showIf.fieldId] : undefined;
  const availableOperators = triggerField ? operatorsForTriggerType(triggerField.type) : [];

  return (
    <div className="settings-section">
      <label className="settings-toggle-row">
        <span className="settings-section-title">Show only if&hellip;</span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!canEdit}
          onChange={(event) => handleToggle(event.target.checked)}
        />
      </label>

      {enabled && existingRule && (
        <div className="conditional-rule-row">
          <select
            className="text-input"
            disabled={!canEdit}
            value={existingRule.showIf.fieldId}
            onChange={(event) => {
              const nextTrigger = schema.fields[event.target.value];
              if (!nextTrigger) return;
              // Same non-empty-array guarantee as above.
              const operator = operatorsForTriggerType(nextTrigger.type)[0] as ConditionOperator;
              const value = isOptionField(nextTrigger) ? (nextTrigger.options[0]?.id ?? '') : '';
              onSetRule({
                fieldId: field.id,
                showIf: { fieldId: nextTrigger.id, operator, value },
              });
            }}
          >
            {candidateFields.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label || 'Untitled field'}
              </option>
            ))}
          </select>

          <select
            className="text-input"
            disabled={!canEdit}
            value={existingRule.showIf.operator}
            onChange={(event) => {
              onSetRule({
                ...existingRule,
                showIf: {
                  ...existingRule.showIf,
                  operator: event.target.value as ConditionOperator,
                },
              });
            }}
          >
            {availableOperators.map((operator) => (
              <option key={operator} value={operator}>
                {OPERATOR_LABELS[operator]}
              </option>
            ))}
          </select>

          {triggerField && isOptionField(triggerField) ? (
            <select
              className="text-input"
              disabled={!canEdit}
              value={existingRule.showIf.value}
              onChange={(event) => {
                onSetRule({
                  ...existingRule,
                  showIf: { ...existingRule.showIf, value: event.target.value },
                });
              }}
            >
              {triggerField.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label || 'Untitled option'}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="text-input"
              type={triggerField?.type === 'date' ? 'date' : 'text'}
              disabled={!canEdit}
              value={existingRule.showIf.value}
              onChange={(event) => {
                onSetRule({
                  ...existingRule,
                  showIf: { ...existingRule.showIf, value: event.target.value },
                });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
