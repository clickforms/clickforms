import { type FormField, isLayoutOnlyField } from '@/lib/forms/schema';

export const FIELD_WIDTHS = ['full', 'half', 'third'] as const;
export type FieldWidth = (typeof FIELD_WIDTHS)[number];

export const FIELD_WIDTH_LABEL: Record<FieldWidth, string> = {
  full: 'Full width',
  half: 'Half width',
  third: 'One third',
};

/** Section breaks and other layout blocks always span the full row. */
export function resolveFieldWidth(field: FormField): FieldWidth {
  if (isLayoutOnlyField(field.type)) return 'full';
  return field.width ?? 'full';
}

export function getFieldWidthClass(field: FormField): string {
  return `field-width--${resolveFieldWidth(field)}`;
}
