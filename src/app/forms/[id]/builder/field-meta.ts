import {
  type ColumnCount,
  type ConditionOperator,
  DEFAULT_DIVIDER_THICKNESS_PX,
  DEFAULT_DIVIDER_WIDTH_PX,
  type FieldOption,
  type FieldType,
  type FormField,
} from '@/lib/forms/schema';

// Shared, non-component constants/helpers for the builder — kept out of builder-client.tsx
// so that file stays focused on state/wiring rather than field-type bookkeeping.

/** Palette/label copy matching splose's naming for each v1 field type (spec 02 "Scope"). */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: 'Short answer',
  paragraph: 'Paragraph',
  multi_choice: 'Multiple choice',
  checkbox: 'Checkboxes',
  dropdown: 'Dropdown',
  date: 'Date',
  time: 'Time',
  email: 'Email',
  file_upload: 'File upload',
  signature: 'Signature',
  section_break: 'Header',
  divider: 'Divider',
  column_layout: 'Columns',
  static_text: 'Formatted Text',
  image: 'Image',
  address: 'Address',
  choice_matrix: 'Choice matrix',
  number: 'Number',
  phone: 'Phone number',
  website: 'Website',
  rating: 'Rating',
  opinion_scale: 'Opinion scale',
  legal: 'Legal / consent',
  hidden: 'Hidden field',
};

/** Default label given to a freshly-added field before the admin renames it. */
export const FIELD_TYPE_DEFAULT_LABEL: Record<FieldType, string> = {
  short_text: 'Short answer question',
  paragraph: 'Paragraph question',
  multi_choice: 'Multiple choice question',
  checkbox: 'Checkbox question',
  dropdown: 'Dropdown question',
  date: 'Date question',
  time: 'Time question',
  email: 'Email question',
  file_upload: 'File upload',
  signature: 'Signature',
  section_break: 'Header',
  divider: 'Divider',
  column_layout: 'Column section',
  static_text: 'Formatted Text',
  image: 'Image',
  address: 'Address question',
  choice_matrix: 'Rating question',
  number: 'Number question',
  phone: 'Phone number question',
  website: 'Website question',
  rating: 'Rating question',
  opinion_scale: 'Opinion scale question',
  legal: 'I agree to the terms',
  hidden: 'Hidden field',
};

function newOption(label: string): FieldOption {
  return { id: crypto.randomUUID(), label };
}

/** Builds a brand-new field of `type` with sensible defaults, ready to drop onto a page. */
export function createDefaultField(type: FieldType): FormField {
  const id = crypto.randomUUID();
  const label = FIELD_TYPE_DEFAULT_LABEL[type];

  switch (type) {
    case 'short_text':
      return { id, type, label, required: false };
    case 'paragraph':
      return { id, type, label, required: false };
    case 'multi_choice':
    case 'checkbox':
    case 'dropdown':
      return {
        id,
        type,
        label,
        required: false,
        options: [newOption('Option 1'), newOption('Option 2')],
      };
    case 'date':
      return { id, type, label, required: false };
    case 'time':
      return { id, type, label, required: false };
    case 'email':
      return { id, type, label, required: false };
    case 'file_upload':
      return { id, type, label, required: false };
    case 'signature':
      return { id, type, label, required: false };
    case 'section_break':
      return { id, type, label, required: false };
    case 'divider':
      // label is optional (an empty caption is the common case — a bare line), but every
      // other field type sets one, so default to '' rather than reusing FIELD_TYPE_DEFAULT_LABEL's
      // copy, which would show up as a visible caption most admins didn't ask for.
      return {
        id,
        type,
        label: '',
        required: false,
        dividerWidthPx: DEFAULT_DIVIDER_WIDTH_PX,
        thicknessPx: DEFAULT_DIVIDER_THICKNESS_PX,
      };
    case 'column_layout':
      throw new Error('Use createColumnLayoutField() for column layouts');
    case 'static_text':
      // `body` is rendered as HTML (see field-input.tsx / field-card.tsx), edited via the
      // RichTextEditor in field-settings-panel.tsx — plain text still works fine since it
      // has no markup to interpret, but new fields start with an actual <p> so the editor
      // has a real paragraph to place the cursor in.
      return {
        id,
        type,
        body: '<p>Add your text here.</p>',
        required: false,
      };
    case 'image':
      return { id, type, label, required: false };
    case 'address':
      return { id, type, label, required: false };
    case 'choice_matrix':
      return {
        id,
        type,
        label,
        required: false,
        rows: [newOption('Row 1'), newOption('Row 2')],
        columns: [newOption('Disagree'), newOption('Neutral'), newOption('Agree')],
      };
    case 'number':
      return { id, type, label, required: false };
    case 'phone':
      return { id, type, label, required: false };
    case 'website':
      return { id, type, label, required: false };
    case 'rating':
      return { id, type, label, required: false };
    case 'opinion_scale':
      return { id, type, label, required: false };
    case 'legal':
      return {
        id,
        type,
        label,
        required: true,
        consentText: 'I agree to the Terms of Service and Privacy Policy.',
      };
    case 'hidden':
      return { id, type, label, required: false };
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unhandled field type: ${exhaustiveCheck}`);
    }
  }
}

/** Builds a column layout with `columns` genuinely empty slots — the admin picks a
 * field type for each slot afterwards (see `setColumnSlotField` in schema-mutations.ts),
 * rather than the layout arriving pre-filled with placeholder fields. */
export function createColumnLayoutField(columns: ColumnCount): {
  layout: FormField;
} {
  const layoutId = crypto.randomUUID();
  const layout: FormField = {
    id: layoutId,
    type: 'column_layout',
    label: `${columns}-column section`,
    required: false,
    columns,
    fieldIds: Array.from({ length: columns }, () => null),
  };
  return { layout };
}

export const COLUMN_LAYOUT_LABELS: Record<ColumnCount, string> = {
  2: '2 columns',
  3: '3 columns',
  4: '4 columns',
};

/** Field types allowed inside a column slot (everything except nested layouts/sections). */
export const COLUMN_CHILD_FIELD_TYPES: FieldType[] = (
  Object.keys(FIELD_TYPE_LABELS) as FieldType[]
).filter((type) => type !== 'column_layout' && type !== 'section_break' && type !== 'divider');

/** Operators valid for a rule whose trigger field is of `triggerType` (spec 02: constrain
 * the operator choices based on the trigger field's type — checkbox answers are arrays, so
 * only "contains" makes sense; every other v1 field type answers with a single string). */
export function operatorsForTriggerType(triggerType: FieldType): ConditionOperator[] {
  return triggerType === 'checkbox' ? ['contains'] : ['equals', 'not_equals'];
}

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'includes',
};
