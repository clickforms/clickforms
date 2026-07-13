# Spec 02 — Form Builder

Depends on: 01-data-model-and-auth.
Blocks: 03-form-renderer (renderer consumes the schema this produces).

## Goal

An authenticated admin can create a form, drag fields onto a multi-page canvas, configure conditional logic, save a draft, and publish a version.

## Scope

- **Field types (v1 set)**: short text, paragraph, multi-choice (single), checkbox (multi), dropdown, date, file upload, signature, section/page break. (Address autocomplete, calculation fields, data lookup — add later if a real form needs them; don't build speculatively.)
- **Schema shape** (stored in `form_versions.schema` JSONB):
  ```
  {
    pages: [{ id, title, fields: [fieldId, ...] }],
    fields: { [fieldId]: { type, label, required, options?, validation? } },
    conditionalLogic: [{ fieldId, showIf: { fieldId, operator, value } }],
    branding: { logoUrl?, primaryColor? }
  }
  ```
- **Builder UI**: drag-and-drop field palette onto a page canvas (reorderable), field settings panel (label, required, validation, options), page management (add/remove/reorder pages), conditional logic editor (simple "show field X if field Y equals Z" — no nested boolean logic in v1).
- **Draft vs. publish**: edits save to a draft `form_versions` row continuously (autosave). "Publish" creates/finalizes a version and updates `forms.current_version_id` — this is the version the public renderer reads. Editing a published form again creates a new draft version, leaving the live one untouched for in-flight submissions.
- **Form list/create/rename/archive** in the admin UI.

## Out of scope

Language translation, custom fonts beyond basic branding, nested/compound conditional logic (AND/OR chains) — start with single-condition show/hide, expand only if a real form needs it.

## Acceptance criteria

- Can build a 3-page form with at least one field of every v1 type, one conditional field, save as draft, then publish.
- Publishing increments `version_number` and updates `current_version_id`; the previous version row is untouched.
- Editing a published form doesn't affect what respondents currently mid-submission see (verified once 03/04 exist).
- Reloading the builder mid-edit restores the autosaved draft.
