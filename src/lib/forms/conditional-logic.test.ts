import { describe, expect, it } from 'vitest';
import { getVisibleFieldIds, isFieldVisible } from '@/lib/forms/conditional-logic';
import { createEmptyFormSchema, type FormSchema } from '@/lib/forms/schema';

// A 2-field form where "ndisNumber" only shows once "hasNdisPlan" is answered "yes",
// plus a "supportTypes" checkbox used to exercise the "contains" operator.
function buildSchema(): FormSchema {
  const base = createEmptyFormSchema();
  return {
    ...base,
    fields: {
      hasNdisPlan: {
        id: 'hasNdisPlan',
        type: 'dropdown',
        label: 'Do you have an NDIS plan?',
        required: true,
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ],
      },
      ndisNumber: {
        id: 'ndisNumber',
        type: 'short_text',
        label: 'NDIS number',
        required: true,
      },
      supportTypes: {
        id: 'supportTypes',
        type: 'checkbox',
        label: 'Support types',
        required: false,
        options: [
          { id: 'therapy', label: 'Therapy' },
          { id: 'coordination', label: 'Support coordination' },
        ],
      },
      coordinatorName: {
        id: 'coordinatorName',
        type: 'short_text',
        label: 'Coordinator name',
        required: false,
      },
    },
    conditionalLogic: [
      {
        fieldId: 'ndisNumber',
        showIf: { fieldId: 'hasNdisPlan', operator: 'equals', value: 'yes' },
      },
      {
        fieldId: 'coordinatorName',
        showIf: { fieldId: 'supportTypes', operator: 'contains', value: 'coordination' },
      },
    ],
  };
}

describe('getVisibleFieldIds', () => {
  it('hides a conditional field when its trigger has no answer yet', () => {
    const schema = buildSchema();
    const visible = getVisibleFieldIds(schema, {});
    expect(visible.has('ndisNumber')).toBe(false);
    expect(visible.has('hasNdisPlan')).toBe(true);
  });

  it('shows a conditional field once the equals condition matches', () => {
    const schema = buildSchema();
    const visible = getVisibleFieldIds(schema, { hasNdisPlan: 'yes' });
    expect(visible.has('ndisNumber')).toBe(true);
  });

  it('hides a conditional field once the trigger changes away from the match', () => {
    const schema = buildSchema();
    const visible = getVisibleFieldIds(schema, { hasNdisPlan: 'no' });
    expect(visible.has('ndisNumber')).toBe(false);
  });

  it('evaluates "contains" against a checkbox (array) answer', () => {
    const schema = buildSchema();
    expect(getVisibleFieldIds(schema, { supportTypes: ['therapy'] }).has('coordinatorName')).toBe(
      false,
    );
    expect(
      getVisibleFieldIds(schema, { supportTypes: ['therapy', 'coordination'] }).has(
        'coordinatorName',
      ),
    ).toBe(true);
  });

  it('always shows fields with no conditional rule targeting them', () => {
    const schema = buildSchema();
    const visible = getVisibleFieldIds(schema, {});
    expect(visible.has('supportTypes')).toBe(true);
  });
});

describe('isFieldVisible', () => {
  it('matches the per-field result to the batch result', () => {
    const schema = buildSchema();
    const answers = { hasNdisPlan: 'yes' };
    expect(isFieldVisible(schema, 'ndisNumber', answers)).toBe(true);
    expect(isFieldVisible(schema, 'ndisNumber', {})).toBe(false);
  });

  it('treats a field with no rule as always visible', () => {
    const schema = buildSchema();
    expect(isFieldVisible(schema, 'hasNdisPlan', {})).toBe(true);
  });
});
