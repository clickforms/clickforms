# Spec 03 — Public Form Renderer

Depends on: 02-form-builder (needs a published schema to render).
Blocks: 04-submission-handling (renderer is what produces submissions).

## Goal

An unauthenticated respondent can open a form's public URL, fill it out on mobile or desktop, have conditional logic evaluated live, and save-and-resume via an emailed link.

## Scope

- **Public route**: `GET /f/:slug` renders the current published `form_versions.schema` for the form. Draft versions are never publicly reachable.
- **Rendering**: schema-driven — the same field-type components used in the builder's live preview, so builder preview and live form never drift.
- **Conditional logic evaluation**: client-side, re-evaluated on every answer change, matching the rules defined in spec 02's schema shape.
- **Validation**: required fields, basic type validation (email format, date range) enforced client-side before page-advance, re-validated server-side on submit (never trust the client alone).
- **Multi-page navigation**: next/back, with in-progress answers held in local component state until save.
- **Save & resume**: "save and continue later" creates a `submissions` row with `status = in_progress` and a `resume_token` (random, unguessable), emails a resume link (`/f/:slug/resume/:token`) via SES if the respondent provided an email field. Token expires after a configurable window (default 30 days).
- **Mobile responsiveness**: single-column layout, touch-friendly signature/file inputs, tested on a real phone viewport, not just browser devtools.

## Out of scope

Offline support, multi-language rendering, custom CSS injection per form beyond the branding fields from spec 02.

## Acceptance criteria

- A field with a conditional rule correctly shows/hides as its trigger field changes, with no page flicker.
- Submitting with a required field empty is blocked both client-side (immediate) and server-side (if the client check is bypassed via direct API call).
- Saving partway through, closing the tab, and returning via the emailed resume link restores all previously entered answers.
- Editing and republishing the form (spec 02) after a respondent has started does not corrupt their in-progress submission — it stays bound to the `form_version_id` it was started against.
- Lighthouse mobile score check or manual test on an actual phone confirms usable layout.
