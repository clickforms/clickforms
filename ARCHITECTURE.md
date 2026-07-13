# Clickforms — System Design

Status: **Finalized v1** — internal-only, architected for future multi-tenant conversion, fully AWS-native.
Owner: mo

## 1. Goals & constraints

**Functional:** replace scattered form workflows for internal NDIS forms — intake, consent, service agreements, support plans, referrals. Drag-drop builder, conditional logic, e-signature with a defensible audit trail, PDF output, file uploads, email notifications.

**Non-functional:**
- AU data residency for all form/submission/file data (NDIS + Australian Privacy Principles) — non-negotiable, even internal-only.
- Solo-maintainable — minimize ops surface, prefer managed services over self-hosted infra.
- Cheap at low volume — should cost well under typical SaaS form-platform pricing at actual usage.
- Schema shaped for multi-tenancy from day one, so "sell to other providers" later doesn't require a rewrite — see §7.
- Not required now: SSO, integration marketplace, analytics dashboards, payments, bookings. Add only when a real need shows up.

## 2. High-level architecture

```
                                    AWS VPC — ap-southeast-2 (Sydney)
                                    ┌───────────────────────────────────────────────┐
Respondent Browser ──┐              │  Public subnet                                 │
                      ├── HTTPS ───>│  EC2 (Docker: Caddy + Next.js app container)   │
Admin Browser ────────┘             │        │                                       │
                                    │        │ security-group-only access            │
                                    │        ▼                                       │
                                    │  Private subnet                                │
                                    │  RDS Postgres (Multi-AZ optional, automated    │
                                    │  backups + PITR, encrypted at rest)            │
                                    └───────────────────────────────────────────────┘
                                             │              │              │
                                             ▼              ▼              ▼
                                        S3 bucket        SES            SNS (optional)
                                    uploads, signature  email          SMS — flagged:
                                    images, PDFs        notifications  not AU data-resident

IAM: EC2 instance role scoped to this S3 bucket + SES/SNS send — no long-lived credentials on the box.
Secrets: SSM Parameter Store (SecureString) for DB creds, session secret, etc. — pulled at container start.
```

One deployable app container behind Caddy on a single EC2 instance. No separate backend service — Next.js API routes serve both the admin UI and the public form-fill API; a separate service would be operational overhead with no benefit at this scale.

**The one change from the previous draft worth calling out:** Postgres moves from self-hosted-in-Docker to RDS. Everything else on the box stays self-hosted (that's where the cost/control benefit actually is), but a stateful database is exactly the kind of thing not worth self-managing when the managed equivalent is ~$15-25/month and removes the single biggest operational risk flagged in the last draft — backups. RDS gives automated daily snapshots + point-in-time recovery for free; a solo-maintained `pg_dump` cron does not.

Everything — compute, database, storage, email — now sits in one AWS account, one region (ap-southeast-2). That's the cleanest data-residency story available: no cross-vendor data flows to reason about at all.

## 3. Stack decisions

| Layer | Choice | Why |
|---|---|---|
| App framework | Next.js 16 (App Router) + TypeScript | One deploy for builder, renderer, and API. Matches your existing stack. (Originally scoped as Next.js 14; bumped to the current stable major, 16, at scaffold time — App Router conventions used here are unchanged.) |
| Compute | Single EC2 instance (e.g. `t4g.small`), Docker Compose — Caddy + app container | Full control, no platform fees. One box is the right size for internal-only usage; §7 covers the move to ECS Fargate if that changes. |
| Reverse proxy/TLS | Caddy | Automatic Let's Encrypt certs, near-zero config. |
| Database | **RDS Postgres**, ap-southeast-2, encrypted, automated backups | Managed — removes backup/PITR risk entirely instead of relying on a self-run cron job. This is the one place self-hosting wasn't worth it. |
| ORM | Prisma | Type-safe schema, migrations, and the place to enforce org-scoping consistently. |
| Auth (admin) | NextAuth v4 (stable line, not the v5/`beta` tag), JWT sessions, credentials provider querying Prisma directly | Self-rolled, admin-only, org-scoped — no external auth provider. No Auth.js Prisma *adapter* (that's built for OAuth account/session persistence); with a single credentials provider and JWT sessions there's nothing for it to store, so `authorize()` queries `users` directly. Revisit if magic-link or OAuth is added later. |
| File storage | AWS S3, ap-southeast-2 | Private bucket, presigned URLs, org-scoped key prefix, IAM-restricted to the EC2 role. |
| Email | AWS SES, ap-southeast-2 | AWS-native, no separate vendor account. |
| SMS | AWS SNS (optional, opt-in per form) | AWS-native; flagged as not AU-guaranteed data-resident like everything else — use sparingly. |
| PDF generation | `@react-pdf/renderer` or Puppeteer | Render submission + signature certificate as PDF server-side. |
| Secrets | AWS SSM Parameter Store (SecureString) | Free tier covers this at our scale; no credentials baked into images or `.env` files on disk. |
| Networking | VPC, EC2 in public subnet (locked-down security group), RDS in private subnet reachable only from that security group | Standard AWS baseline — RDS is never internet-reachable. |
| CI/CD | GitHub Actions → build → push to ECR → SSH to EC2 → `docker compose pull && up -d` | ECR keeps this AWS-native and sets up a clean path to ECS Fargate later without changing how images are built. |
| Monitoring | CloudWatch (EC2/RDS metrics + alarms) + Sentry (app errors) | CloudWatch is free-tier infra monitoring already included with AWS; Sentry stays for application-level error tracking. |

## 3.1 Developer tooling

| Tool | Choice | Why |
|---|---|---|
| Package manager | Yarn 4 (Berry), `node-modules` linker | Faster and more reliable than npm; `node-modules` linker (not PnP) avoids compatibility friction with Prisma's generated client and Next.js — both still assume a traditional `node_modules` tree. `corepack enable` pins the exact Yarn version per-repo, so CI and local dev never drift. |
| Language | TypeScript, `strict: true` | Non-negotiable for a schema-driven form builder where a JSONB shape mismatch is a runtime bug in production, not a compile error. |
| Lint + format | Biome | Single fast tool replacing ESLint + Prettier — one config file, one dependency, sub-second runs. Drop to ESLint + Prettier only if a specific plugin Biome doesn't yet support turns out to be a blocker. |
| Git hooks | Husky + lint-staged | Runs Biome + `tsc --noEmit` on staged files pre-commit — catches type/lint errors before they hit CI, not after. |
| Unit/component tests | Vitest | ESM-native, fast, same mental model as Jest without the config overhead. Used for form-schema validation logic, conditional-logic evaluation, hash/audit-trail computation (spec 05) — the parts of this system where a silent bug is expensive. |
| E2E tests | Playwright | Deferred until the renderer (spec 03) exists, but the standard modern choice when that testing work starts — real browser coverage for the multi-page form-fill flow. |
| Runtime validation | Zod | Validates form schemas and submission payloads server-side (specs 02-04) — the actual enforcement behind "never trust the client," not just a TypeScript-time guarantee. |
| Scripts/tooling runner | `tsx` | Run TypeScript scripts (seed script, one-off migrations) directly without a separate build step. |

## 4. Data model

Every table carries `organization_id` from day one, even though there's exactly one organization today. This is the one decision that prevents a rewrite if this becomes multi-tenant.

```
organizations
  id, name, created_at

users
  id, organization_id (FK), email, role [admin|editor|viewer], created_at

forms
  id, organization_id (FK), name, slug, status [draft|published|archived],
  current_version_id (FK -> form_versions), created_by, created_at, updated_at

form_versions
  id, form_id (FK), organization_id (FK), schema (JSONB: pages, fields, conditional logic, branding),
  version_number, published_at
  -- versioned so editing a live form never breaks in-flight submissions

submissions
  id, organization_id (FK), form_id (FK), form_version_id (FK),
  status [in_progress|submitted|approved|rejected],
  answers (JSONB), resume_token, ip_address, submitted_at, created_at

submission_files
  id, submission_id (FK), organization_id (FK), field_key,
  storage_key, filename, mime_type, size_bytes, uploaded_at

signatures
  id, submission_id (FK), organization_id (FK), field_key,
  signature_image_key, signer_name, consent_text_version,
  ip_address, user_agent, signed_at, content_hash

workflow_steps        -- only if/when approval workflows are needed
  id, submission_id (FK), organization_id (FK), step_order,
  approver_user_id (FK), status, acted_at, comments

audit_log
  id, organization_id (FK), actor_user_id (FK, nullable for public actions),
  action, entity_type, entity_id, metadata (JSONB), created_at
```

**Multi-tenancy enforcement:** Postgres Row-Level Security (RLS) policies on every table, keyed off a session variable (`app.current_org_id`) set per request. This is enforced at the database layer, not just in application code — the cheap insurance against an app-layer bug ever leaking data across orgs once there's more than one. Costs almost nothing to set up now with one org; expensive to bolt on retroactively.

**File storage layout:** `org_id/form_id/submission_id/filename` — physical isolation matches logical isolation.

## 5. API surface

Admin (authenticated, org-scoped via session):
```
GET    /api/forms
POST   /api/forms
GET    /api/forms/:id
PATCH  /api/forms/:id
POST   /api/forms/:id/publish
GET    /api/submissions?formId=
GET    /api/submissions/:id
GET    /api/submissions/:id/pdf
POST   /api/submissions/:id/approve   (if workflows added)
```

Public (no auth, rate-limited):
```
GET    /api/f/:slug                    -- fetch published schema only
POST   /api/f/:slug/submissions        -- create/save submission
PATCH  /api/f/:slug/submissions/:token -- resume + update
POST   /api/f/:slug/submissions/:token/sign
POST   /api/f/:slug/submissions/:token/upload
```

## 6. E-signature audit trail (the part worth taking seriously)

To be legally defensible for NDIS service agreements, each signature record captures: signer name as typed, the exact consent text version shown at signing time, IP address, user agent, timestamp, and a SHA-256 hash of (answers + signature image + timestamp) computed at signing time. The generated PDF includes a certificate page with this metadata. This is the one area where cutting corners creates real liability — everything else in the system degrades gracefully if imperfect; this doesn't.

## 7. Path to multi-tenant (later, not now)

Because `organization_id` and RLS are already in place, going multi-tenant means adding, not rewriting:
- Org creation + invite flow
- Org switcher in the admin UI
- Billing (Stripe subscriptions, usage metering if needed)
- Per-org branding/subdomain
- Tightening RLS policies (already there, just currently trivial with one org)

Nothing in §4-§6 changes.

## 8. Build phases

1. **Scaffold** — AWS account/VPC/EC2/RDS/S3 setup, repo, Prisma schema + RLS, Auth.js, empty admin shell. (See `specs/00-infrastructure.md` and `specs/01-data-model-and-auth.md`.)
2. **Builder + renderer core** — drag-drop builder, field types, conditional logic, multi-page, schema versioning.
3. **Submission handling** — file upload, save & resume, email notification on submit.
4. **E-signature + PDF** — signing UI, audit trail capture, PDF generation with certificate page.
5. **Admin dashboard** — view/search/export submissions, CSV export.
6. **Deferred/optional** — approval workflows, SMS, payments, bookings — build only when a real form needs them.

## 9. Explicitly out of scope for v1

SSO, analytics/reporting dashboards, Power Automate / Make integrations, practice-management integrations, integration marketplace, multi-language forms. These are what multi-tenant SaaS form platforms need to serve thousands of orgs with different requirements — not needed for one org's internal forms. Revisit if this becomes a sellable product.

## 10. Operational responsibilities

Using RDS instead of self-hosted Postgres removes the biggest risk (backups/PITR are now automatic). What's still on you, running the app on a single self-managed EC2 instance:

- **OS hardening** — security group locked to 22/80/443, SSH key-only auth (no passwords), `fail2ban`, unattended security upgrades on the instance.
- **TLS renewal** — Caddy handles this automatically; alert on renewal failures rather than discovering an expired cert from a user report.
- **Patching cadence** — Docker base images and host OS packages need a regular update rhythm. This was previously a platform SLA; now it's a recurring task on your calendar.
- **IAM hygiene** — the EC2 instance role should hold only S3/SES/SNS permissions it actually needs, nothing account-wide. Rotate/review periodically.
- **Single point of failure (compute)** — one EC2 instance means the app goes down if that box does, though RDS can be Multi-AZ independently if that risk matters before the app does. Acceptable at internal-only scale; revisit (ECS Fargate with 2+ tasks behind a load balancer) if this becomes customer-facing SaaS.

## 11. Path to ECS Fargate (later, if traffic/reliability demands it)

Because the app is already a Docker image pushed to ECR, moving off a single EC2 box means: define an ECS task definition from the same image, add an Application Load Balancer + target group, point Route53 at the ALB instead of the EC2 Elastic IP, and set desired task count ≥ 2 across AZs. No application code changes — this is purely an infra swap, which is the reason ECR was chosen over a simpler registry-free deploy now.
