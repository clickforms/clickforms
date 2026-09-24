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

/** The condition value a freshly-picked trigger field should start with — the first real
 * option for an option field, 'yes' for a yes_no field (see the matching special-case in
 * the value <select> below), otherwise '' for a free-text/date value the admin types in. */
function defaultConditionValue(field: FormField): string {
  if (isOptionField(field)) return field.options[0]?.id ?? '';
  if (field.type === 'yes_no') return 'yes';
  return '';
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
    const value = defaultConditionValue(firstCandidate);
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
              const value = defaultConditionValue(nextTrigger);
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
          ) : triggerField?.type === 'yes_no' ? (
            // yes_no has no admin-editable `options` list (isOptionField above only
            // covers multi_choice/checkbox/dropdown) but its answer is still a closed set
            // of two fixed literals — a free-text box would let an admin type a condition
            // value that can never actually match a submitted answer.
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
              <option value="yes">{triggerField.yesLabel || 'Yes'}</option>
              <option value="no">{triggerField.noLabel || 'No'}</option>
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
