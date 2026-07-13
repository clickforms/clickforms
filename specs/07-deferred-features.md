# Spec 07 — Deferred Features (backlog, not v1)

These are real form-platform features that are deliberately not in the v1 build (ARCHITECTURE.md §9). Scoped here briefly so nothing is lost or forgotten — build only when a specific form actually needs one of these, not speculatively.

## Approval workflows

`workflow_steps` table already exists in the spec 01 schema, unused until this is built. Would add: multi-step routing (e.g. coordinator → manager approval), each step assigned to a user or role, status per step, notification on each handoff. Triggered by a "requires approval" flag on the form, configured in the builder.

## SMS notifications

AWS SNS is already the chosen provider (ARCHITECTURE.md §3) for when this is needed — flagged as not guaranteed AU-resident, so use only for non-sensitive notifications (e.g. "your appointment is confirmed"), never for content containing participant details.

## Payments

Stripe integration on a payment-type field, similar in shape to the file-upload field but posting to Stripe's API. PCI scope stays minimal by using Stripe Elements/Checkout (never handling raw card data server-side). Worth real scoping time when it's needed — reconciliation edge cases (partial refunds, failed payments mid-submission) are the actual complexity here, not the integration itself.

## Bookings/appointments

Calendar slot definition + conflict checking, tied to a booking-type field. Needs its own data model (`availability_slots`, `bookings`) — not sketched here since nothing in the current NDIS forms use case needs it yet.

## Multi-tenant conversion

Covered in ARCHITECTURE.md §7 — org creation/invite flow, org switcher, billing, per-org branding. This is the big one: revisit only if Clickforms becomes a product sold to other providers, not a feature to build "just in case."

## SSO / 2FA

Deferred per ARCHITECTURE.md §9 — add when there's more than a handful of known internal users, or when a customer (post multi-tenant) requires it contractually.
