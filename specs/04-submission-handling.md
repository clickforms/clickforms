# Spec 04 — Submission Handling

Depends on: 03-form-renderer.
Blocks: 05-esignature-and-pdf (PDFs are generated from completed submissions), 06-admin-dashboard (reads submissions).

## Goal

Submitted form data and uploaded files are stored correctly and safely, the admin is notified, and submissions are exportable.

## Scope

- **Submit endpoint**: `POST /api/f/:slug/submissions` (create) and `PATCH .../:token` (update/resume) — validates server-side against the field schema, writes `answers` JSONB, sets `status = submitted`, `submitted_at`.
- **File uploads**: client requests a presigned S3 PUT URL scoped to `org_id/form_id/submission_id/filename`, uploads directly to S3 (not proxied through the app server), then confirms the upload by writing a `submission_files` row. Enforce file size limit (e.g. 20MB) and an allowlist of MIME types at presign time.
- **Email notification**: on `status = submitted`, send an SES email to the form's configured notification recipient(s) with a summary + link to view the submission in the admin dashboard.
- **CSV export**: `GET /api/forms/:id/submissions/export.csv` — flattens `answers` JSONB into columns based on the form's field schema, streams as a download. Admin-only, org-scoped.
- **Rate limiting**: public submission endpoints get basic IP-based rate limiting (e.g. 10 requests/minute) to blunt casual abuse — full bot protection (CAPTCHA) is a fast-follow, not blocking v1.

## Out of scope

SMS notifications (spec 07), approval workflow routing (spec 07), virus scanning on uploads (flag as a future enhancement — note it in the spec but don't block v1 on it).

## Acceptance criteria

- Submitting a form with a file upload results in the file present in S3 at the correct key, and a matching `submission_files` row.
- The notification email arrives within a reasonable time (say, under a minute) of submission.
- CSV export of a form with 50+ varied submissions produces correct, correctly-escaped columns matching every field in the schema, including ones added after some submissions already existed (missing = blank cell, not an error).
- A submission attempt exceeding the file size limit or with a disallowed MIME type is rejected with a clear error, not a silent failure.
- Rate limit triggers correctly under a simple load test (e.g. 20 rapid requests from one IP).
