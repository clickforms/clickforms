# Spec 06 — Admin Dashboard

Depends on: 05-esignature-and-pdf (needs submissions + generated PDFs to display).
Blocks: nothing — this is the last core-scope spec.

## Goal

An admin can manage forms and find, view, and act on submissions without touching the database directly.

## Scope

- **Forms list**: table of all forms (draft/published/archived), with create/edit/publish/archive actions, links into the builder (spec 02).
- **Submissions list** (per form): table with key columns (submitted date, respondent identifier if known, status), search/filter by date range and status, pagination for forms with large submission counts.
- **Submission detail view**: renders the filled answers in a readable layout, shows uploaded files (with presigned download links), shows signature + link to the generated PDF, shows the audit trail fields from spec 05 for transparency.
- **CSV export** entry point (already built in spec 04) surfaced here as a button.
- **Basic user management**: admin can list users in the org and their roles; invite/create is a simple form (email + role), no invite-email flow needed yet with only a handful of known internal users — admin sets a temp password directly.

## Out of scope

Analytics/reporting dashboards, saved custom views, bulk actions beyond CSV export — add only if actually used day-to-day once the team is live on this.

## Acceptance criteria

- An admin can go from "which forms exist" to "view a specific submission's PDF" in three clicks or fewer.
- Search/filter on the submissions list returns correct results against a seeded set of 100+ test submissions with varied dates/statuses.
- A `viewer`-role user can see submissions but cannot edit forms or user management (role enforcement re-verified at the UI layer, not just the API layer from spec 01).
- Archiving a form removes it from the default forms list but its historical submissions remain fully accessible.
