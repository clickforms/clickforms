import { createColumnLayoutField, createDefaultField } from '@/app/forms/[id]/builder/field-meta';
import type {
  ColumnCount,
  ConditionalRule,
  FieldType,
  FormField,
  FormPage,
  FormSchema,
} from '@/lib/forms/schema';
import { collectPageFieldIds } from '@/lib/forms/schema';

// Pure functions over FormSchema — every builder mutation goes through one of these so
// builder-client.tsx never hand-rolls array/record surgery inline. Each function returns a
// brand-new FormSchema (never mutates its argument) so React state updates stay predictable.

// `keyof` a union type only yields the keys common to *every* member (id/label/required/
// helpText/type), so a plain `Partial<FormField>` would silently reject a `{ options }` or
// `{ validation }` patch at the type level even though it's valid for the field's actual
// variant. Distributing `Partial` over each union member first (the standard
// `T extends unknown ? ... : never` idiom) keeps those per-variant keys available.
type DistributivePartial<T> = T extends unknown ? Partial<T> : never;
export type FieldPatch = DistributivePartial<FormField>;

function collectFieldIdsToRemove(
  field: FormField | undefined,
  _fields: Record<string, FormField>,
): Set<string> {
  const ids = new Set<string>();
  if (!field) return ids;
  ids.add(field.id);
  if (field.type === 'column_layout') {
    for (const childId of field.fieldIds) {
      if (childId !== null) ids.add(childId);
    }
  }
  return ids;
}

/** Returns the column_layout that owns `fieldId`, if any. */
export function findParentColumnLayout(
  schema: FormSchema,
  fieldId: string,
): Extract<FormField, { type: 'column_layout' }> | null {
  for (const field of Object.values(schema.fields)) {
    if (field.type === 'column_layout' && field.fieldIds.includes(fieldId)) {
      return field;
    }
  }
  return null;
}

/** Field types that can live inside a column slot (not nested layouts/sections). */
export function isColumnChildFieldType(type: FieldType): boolean {
  return type !== 'column_layout' && type !== 'section_break';
}

export function addPage(schema: FormSchema, page: FormPage): FormSchema {
  return { ...schema, pages: [...schema.pages, page] };
}

export function renamePage(schema: FormSchema, pageId: string, title: string): FormSchema {
  return {
    ...schema,
    pages: schema.pages.map((page) => (page.id === pageId ? { ...page, title } : page)),
  };
}

/** Removes a page and every field that only lived on that page (fields are not shared
 * across pages in this schema, so "belongs to this page" is unambiguous). */
export function removePage(schema: FormSchema, pageId: string): FormSchema {
  const page = schema.pages.find((p) => p.id === pageId);
  if (!page) return schema;

  const removedFieldIds = new Set(collectPageFieldIds(page, schema.fields));
  const fields = Object.fromEntries(
    Object.entries(schema.fields).filter(([fieldId]) => !removedFieldIds.has(fieldId)),
  );

  return {
    ...schema,
    pages: schema.pages.filter((p) => p.id !== pageId),
    fields,
    conditionalLogic: schema.conditionalLogic.filter(
      (rule) => !removedFieldIds.has(rule.fieldId) && !removedFieldIds.has(rule.showIf.fieldId),
    ),
  };
}

export function reorderPages(schema: FormSchema, orderedPageIds: string[]): FormSchema {
  const pageById = new Map(schema.pages.map((page) => [page.id, page]));
  const pages = orderedPageIds
    .map((id) => pageById.get(id))
    .filter((page): page is FormPage => page !== undefined);
  return { ...schema, pages };
}

export function addFieldToPage(
  schema: FormSchema,
  pageId: string,
  field: FormField,
  index?: number,
): FormSchema {
  return {
    ...schema,
    fields: { ...schema.fields, [field.id]: field },
    pages: schema.pages.map((page) => {
      if (page.id !== pageId) return page;
      const fields = [...page.fields];
      const insertAt =
        index === undefined ? fields.length : Math.max(0, Math.min(index, fields.length));
      fields.splice(insertAt, 0, field.id);
      return { ...page, fields };
    }),
  };
}

/** Inserts a multi-column row with genuinely empty slots. Returns the layout field id. */
export function addColumnLayoutToPage(
  schema: FormSchema,
  pageId: string,
  columns: ColumnCount,
  index?: number,
): { schema: FormSchema; layoutId: string } {
  const { layout } = createColumnLayoutField(columns);
  const next = addFieldToPage(schema, pageId, layout, index);
  return { schema: next, layoutId: layout.id };
}

/** Fills an empty column slot with a brand-new field of `type`. No-op if the slot is
 * already occupied or out of range. Returns the new field's id alongside the schema. */
export function setColumnSlotField(
  schema: FormSchema,
  layoutId: string,
  slotIndex: number,
  type: FieldType,
): { schema: FormSchema; fieldId: string } | null {
  const layout = schema.fields[layoutId];
  if (layout?.type !== 'column_layout') return null;
  if (slotIndex < 0 || slotIndex >= layout.fieldIds.length) return null;
  if (layout.fieldIds[slotIndex] !== null) return null;
  if (!isColumnChildFieldType(type)) return null;

  const created = createDefaultField(type);
  const fieldIds = layout.fieldIds.map((id, i) => (i === slotIndex ? created.id : id));
  const fields = {
    ...schema.fields,
    [created.id]: created,
    [layoutId]: { ...layout, fieldIds },
  };
  return { schema: { ...schema, fields }, fieldId: created.id };
}

export function removeField(schema: FormSchema, fieldId: string): FormSchema {
  const parentLayout = findParentColumnLayout(schema, fieldId);
  if (parentLayout) {
    // Nested column slots stay in place — clearing empties the cell (null) rather than
    // reseeding it with a placeholder field, so the admin sees a real empty slot again.
    const fieldIds = parentLayout.fieldIds.map((id) => (id === fieldId ? null : id));
    const fields = { ...schema.fields };
    delete fields[fieldId];
    fields[parentLayout.id] = { ...parentLayout, fieldIds };
    return {
      ...schema,
      fields,
      conditionalLogic: schema.conditionalLogic.filter(
        (rule) => rule.fieldId !== fieldId && rule.showIf.fieldId !== fieldId,
      ),
    };
  }

  const idsToRemove = collectFieldIdsToRemove(schema.fields[fieldId], schema.fields);
  const fields = { ...schema.fields };
  for (const id of idsToRemove) {
    delete fields[id];
  }

  return {
    ...schema,
    fields,
    pages: schema.pages.map((page) => ({
      ...page,
      fields: page.fields.filter((id) => !idsToRemove.has(id)),
    })),
    conditionalLogic: schema.conditionalLogic.filter(
      (rule) => !idsToRemove.has(rule.fieldId) && !idsToRemove.has(rule.showIf.fieldId),
    ),
  };
}

/** Swaps a field's type in place (same id / column slot). Used for column cells and
 * the settings type picker. Layout containers cannot be converted this way. */
export function replaceFieldType(schema: FormSchema, fieldId: string, type: FieldType): FormSchema {
  const existing = schema.fields[fieldId];
  if (!existing) return schema;
  if (existing.type === 'column_layout' || existing.type === 'section_break') return schema;
  if (!isColumnChildFieldType(type)) return schema;
  if (existing.type === type) return schema;

  const created = createDefaultField(type);
  const existingHelpText =
    'helpText' in existing && typeof existing.helpText === 'string' ? existing.helpText : undefined;
  const replacement = {
    ...created,
    id: fieldId,
    label: existing.label?.trim() ? existing.label : created.label,
    required: existing.required,
    ...(existingHelpText !== undefined ? { helpText: existingHelpText } : {}),
    width: existing.width ?? created.width,
  } as FormField;

  return {
    ...schema,
    fields: { ...schema.fields, [fieldId]: replacement },
    // Type change can invalidate operators / values on rules targeting this field.
    conditionalLogic: schema.conditionalLogic.filter(
      (rule) => rule.fieldId !== fieldId && rule.showIf.fieldId !== fieldId,
    ),
  };
}

export function updateField(schema: FormSchema, fieldId: string, patch: FieldPatch): FormSchema {
  const existing = schema.fields[fieldId];
  if (!existing) return schema;
  // `patch` is a FieldPatch (Partial<FormField>, distributed over the union) spread onto
  // the existing discriminated-union member — callers are responsible for only ever
  // patching keys valid for `existing.type` (the settings panel only renders controls for
  // keys that apply to the selected field's type), so this cast reflects a real invariant
  // rather than papering over a type error.
  const updated = { ...existing, ...patch } as FormField;
  return { ...schema, fields: { ...schema.fields, [fieldId]: updated } };
}

/** Changes the number of columns in a layout, adding or removing child fields as needed. */
export function setColumnLayoutColumns(
  schema: FormSchema,
  layoutId: string,
  columns: ColumnCount,
): FormSchema {
  const layout = schema.fields[layoutId];
  if (layout?.type !== 'column_layout') return schema;
  if (layout.columns === columns && layout.fieldIds.length === columns) return schema;

  let next: FormSchema = schema;
  let fieldIds = [...layout.fieldIds];

  // Growing adds empty slots — no placeholder fields created.
  while (fieldIds.length < columns) {
    fieldIds.push(null);
  }

  if (fieldIds.length > columns) {
    const removed = fieldIds.slice(columns).filter((id): id is string => id !== null);
    fieldIds = fieldIds.slice(0, columns);
    const fields = { ...next.fields };
    for (const id of removed) {
      delete fields[id];
    }
    next = {
      ...next,
      fields,
      conditionalLogic: next.conditionalLogic.filter(
        (rule) => !removed.includes(rule.fieldId) && !removed.includes(rule.showIf.fieldId),
      ),
    };
  }

  return updateField(next, layoutId, { columns, fieldIds });
}

export function reorderFieldsInPage(
  schema: FormSchema,
  pageId: string,
  orderedFieldIds: string[],
): FormSchema {
  return {
    ...schema,
    pages: schema.pages.map((page) =>
      page.id === pageId ? { ...page, fields: orderedFieldIds } : page,
    ),
  };
}

function cloneField(field: FormField): FormField {
  const id = crypto.randomUUID();
  const cloned = { ...field, id } as FormField;

  if ('options' in cloned && cloned.options) {
    return {
      ...cloned,
      options: cloned.options.map((option) => ({ ...option, id: crypto.randomUUID() })),
    } as FormField;
  }

  // choice_matrix has no `options`, but its `rows`/`columns` arrays are the same shape
  // and need the same treatment — otherwise the duplicate shares array references with
  // the original, and editing one's rows/columns would mutate the other's.
  if (cloned.type === 'choice_matrix') {
    return {
      ...cloned,
      rows: cloned.rows.map((row) => ({ ...row, id: crypto.randomUUID() })),
      columns: cloned.columns.map((column) => ({ ...column, id: crypto.randomUUID() })),
    } as FormField;
  }

  return cloned;
}

/** Inserts a duplicate of `fieldId` immediately after the original on the same page. */
export function duplicateField(schema: FormSchema, pageId: string, fieldId: string): FormSchema {
  const page = schema.pages.find((entry) => entry.id === pageId);
  const existing = schema.fields[fieldId];
  if (!page || !existing) return schema;

  const index = page.fields.indexOf(fieldId);
  if (index === -1) return schema;

  if (existing.type === 'column_layout') {
    let next = schema;
    const newChildIds: (string | null)[] = [];
    for (const childId of existing.fieldIds) {
      if (childId === null) {
        newChildIds.push(null);
        continue;
      }
      const child = schema.fields[childId];
      if (!child) {
        newChildIds.push(null);
        continue;
      }
      const clonedChild = cloneField(child);
      newChildIds.push(clonedChild.id);
      next = { ...next, fields: { ...next.fields, [clonedChild.id]: clonedChild } };
    }
    const clonedLayout = {
      ...existing,
      id: crypto.randomUUID(),
      fieldIds: newChildIds,
    } as FormField;
    next = addFieldToPage(next, pageId, clonedLayout, index + 1);
    const rule = schema.conditionalLogic.find((entry) => entry.fieldId === fieldId);
    if (rule) {
      next = setConditionalRule(next, { ...rule, fieldId: clonedLayout.id });
    }
    return next;
  }

  const cloned = cloneField(existing);
  const rule = schema.conditionalLogic.find((entry) => entry.fieldId === fieldId);
  const nextFields = [...page.fields];
  nextFields.splice(index + 1, 0, cloned.id);

  let next = addFieldToPage(schema, pageId, cloned, index + 1);
  if (rule) {
    next = setConditionalRule(next, { ...rule, fieldId: cloned.id });
  }
  return next;
}

/** At most one rule per field (spec 02: no AND/OR chains) — replaces any existing rule
 * targeting `rule.fieldId` rather than appending. */
export function setConditionalRule(schema: FormSchema, rule: ConditionalRule): FormSchema {
  return {
    ...schema,
    conditionalLogic: [...schema.conditionalLogic.filter((r) => r.fieldId !== rule.fieldId), rule],
  };
}

export function clearConditionalRule(schema: FormSchema, fieldId: string): FormSchema {
  return {
    ...schema,
    conditionalLogic: schema.conditionalLogic.filter((rule) => rule.fieldId !== fieldId),
  };
}
