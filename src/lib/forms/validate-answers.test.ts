import { describe, expect, it } from 'vitest';
import { createEmptyFormSchema, type FormSchema } from '@/lib/forms/schema';
import { validateAnswers, validatePageAnswers } from '@/lib/forms/validate-answers';

function buildSchema(): FormSchema {
  const base = createEmptyFormSchema();
  return {
    ...base,
    pages: [
      { id: 'page1', title: 'Page 1', fields: ['hasNdisPlan', 'ndisNumber'] },
      { id: 'page2', title: 'Page 2', fields: ['supportTypes', 'startDate', 'bio'] },
    ],
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
        required: true,
        options: [
          { id: 'therapy', label: 'Therapy' },
          { id: 'coordination', label: 'Support coordination' },
        ],
      },
      startDate: {
        id: 'startDate',
        type: 'date',
        label: 'Start date',
        required: false,
        validation: { minDate: '2026-01-01' },
      },
      bio: {
        id: 'bio',
        type: 'paragraph',
        label: 'Bio',
        required: false,
        validation: { maxLength: 10 },
      },
    },
    conditionalLogic: [
      {
        fieldId: 'ndisNumber',
        showIf: { fieldId: 'hasNdisPlan', operator: 'equals', value: 'yes' },
      },
    ],
  };
}

describe('validateAnswers', () => {
  it('flags a missing required field', () => {
    const errors = validateAnswers(buildSchema(), {});
    expect(errors.hasNdisPlan).toBeTruthy();
    expect(errors.supportTypes).toBeTruthy();
  });

  it('does not require a conditionally-hidden field', () => {
    const errors = validateAnswers(buildSchema(), { hasNdisPlan: 'no', supportTypes: ['therapy'] });
    expect(errors.ndisNumber).toBeUndefined();
  });

  it('requires a conditionally-visible field once its trigger matches', () => {
    const errors = validateAnswers(buildSchema(), {
      hasNdisPlan: 'yes',
      supportTypes: ['therapy'],
    });
    expect(errors.ndisNumber).toBeTruthy();
  });

  it('rejects an option id that does not exist on the field', () => {
    const errors = validateAnswers(buildSchema(), {
      hasNdisPlan: 'maybe',
      supportTypes: ['therapy'],
    });
    expect(errors.hasNdisPlan).toBeTruthy();
  });

  it('enforces date range and text length validation', () => {
    const errors = validateAnswers(buildSchema(), {
      hasNdisPlan: 'no',
      supportTypes: ['therapy'],
      startDate: '2025-06-01',
      bio: 'this is way too long',
    });
    expect(errors.startDate).toBeTruthy();
    expect(errors.bio).toBeTruthy();
  });

  it('passes with a fully valid, minimal answer set', () => {
    const errors = validateAnswers(buildSchema(), { hasNdisPlan: 'no', supportTypes: ['therapy'] });
    expect(errors).toEqual({});
  });
});

describe('validatePageAnswers', () => {
  it('only validates fields belonging to the given page', () => {
    const schema = buildSchema();
    const page2 = schema.pages[1];
    if (!page2) throw new Error('expected page2 to exist');
    const errors = validatePageAnswers(schema, page2, {});
    expect(errors.hasNdisPlan).toBeUndefined();
    expect(errors.supportTypes).toBeTruthy();
  });
});
