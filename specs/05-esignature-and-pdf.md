# Spec 05 — E-Signature & PDF Generation

Depends on: 04-submission-handling.
Blocks: 06-admin-dashboard (dashboard links to/displays these PDFs).

This is the spec worth reading most carefully — it's the one place in the whole project where a shortcut creates real legal exposure, not just tech debt.

## Goal

A signature captured on a form is defensible as evidence of consent, and every submission with a signature produces a PDF containing both the filled form and a signing certificate.

## Scope

- **Signature capture**: canvas-based draw-to-sign field (mouse or touch), typed-name fallback if required. Captured as a PNG, uploaded to S3 like any other file.
- **Audit trail fields** (written to the `signatures` table at the moment of signing, not reconstructed later):
  - `signer_name` — as typed/confirmed by the signer
  - `consent_text_version` — the exact wording shown above the signature field at signing time (store a version identifier, and keep historical consent text immutable once used)
  - `ip_address`, `user_agent` — captured server-side from the request, not trusted from the client
  - `signed_at` — server timestamp, not client clock
  - `content_hash` — SHA-256 of `(answers JSON + signature image bytes + signed_at)`, computed server-side at signing time and stored. This lets you later prove the submission wasn't altered post-signing: recomputing the hash from stored data should match.
- **PDF generation**: on submission completion, render a PDF with (1) the filled form in a readable layout, and (2) a certificate page listing all audit trail fields above, human-readable. Store the generated PDF in S3, linked from the `submissions` row.
- **PDF regeneration is forbidden after the fact** — once generated at signing time, the PDF and hash are immutable. If a bug requires fixing the PDF template, that only applies to future submissions; past ones keep their original.

## Out of scope

Third-party e-signature certification (e.g. DocuSign-style trust seals) — the audit trail above is what most NDIS service agreements require, but if a plan manager or auditor ever specifically demands a certified third-party e-signature standard, that's a "come back and evaluate" item, not a v1 requirement to guess at now.

## Acceptance criteria

- A signed submission's PDF contains a certificate page with every audit trail field populated, no blanks.
- Recomputing the hash from the stored answers, signature image, and timestamp matches `content_hash` exactly.
- IP address and user agent in the record match what the request actually sent (verified by manual test with a known client).
- Attempting to "re-sign" or edit a submitted, signed submission is blocked — signed submissions are read-only.
- The consent text shown to a signer is retrievable later exactly as it appeared, even if the form's consent wording is edited afterward (proves version immutability).
