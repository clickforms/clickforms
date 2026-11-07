# Clickforms Deployment Guide

Staging and production are the same Docker Compose stack (`docker-compose.yml`: an `app`
container behind `caddy` for TLS termination), same RDS Postgres engine, same S3 bucket
shape — everything that differs between them is one `.env` file per EC2 instance and one
env var in each GitHub Actions run. There is no environment-specific code path; if it works
on staging it's the same artifact that gets promoted to production.

CI/CD follows **build once, promote the artifact**: `deploy-staging.yml` builds a single
arm64 image on every push to `main`, tags it `sha-<shortsha>`, pushes to ECR, and deploys it
to staging. `promote-production.yml` is manual-only and redeploys that *exact same* image
tag to production — production never gets its own build.

---

## 1. One-time AWS infrastructure setup

Run once per AWS account / per environment, in this order. All scripts live in `scripts/`,
require the AWS CLI configured against the target account, and are safe to re-run (they skip
anything that already exists).

1. **ECR (once, shared by both environments):**
   ```
   ./scripts/setup-ecr.sh
   ```
   Creates the single `clickforms` repository both staging and production pull from, with
   `IMMUTABLE` tags and a lifecycle rule that expires untagged images after 7 days.

2. **GitHub OIDC (once, shared):**
   ```
   GITHUB_ORG=<org> GITHUB_REPO=<repo> ./scripts/setup-github-oidc.sh
   ```
   Creates an IAM OIDC provider + a role GitHub Actions assumes via short-lived tokens — no
   long-lived AWS access keys anywhere. The role is scoped to push/pull only the `clickforms`
   ECR repo, and only for workflows running in that exact GitHub repo. Prints an `AWS_ROLE_ARN`
   — add it as a repo secret (see §3).

3. **Per environment** (`ENVIRONMENT=staging` first, then repeat with `ENVIRONMENT=production`):
   ```
   ENVIRONMENT=staging ./scripts/setup-s3.sh
   ENVIRONMENT=staging ./scripts/setup-rds.sh
   ENVIRONMENT=staging ./scripts/setup-ec2.sh
   ```
   - `setup-s3.sh` creates a private, encrypted, no-public-access bucket
     (`clickforms-staging` / `clickforms-prod` — note production is `-prod`, not
     `-production`, see the script's comment).
   - `setup-rds.sh` creates a Postgres 16 instance, generates a master password with
     `openssl` and shows the resulting `DATABASE_URL` once (copied to your clipboard on
     macOS) so you can paste it into the environment's Infisical secrets.
     Initially opens port 5432 to *your current IP only* so you can run the first migration
     before EC2 exists.
   - `setup-ec2.sh` launches the instance (Amazon Linux 2023, arm64, `t4g.small`, 30GB gp3),
     installs Docker + Compose via user-data, allocates an Elastic IP, writes
     an empty `/srv/clickforms/.env` on the box, and creates a scoped instance IAM role (S3
     access to that bucket only, ECR pull — email goes through Resend's HTTPS API, not
     an AWS service, so there's no SES permission to grant here; see "Email (Resend) setup"
     under §4). It also **reconciles RDS
     networking**: swaps the "your IP" rule for "this EC2 instance's security group only"
     and flips RDS to `--no-publicly-accessible`. From this point on, the database is
     reachable only from inside that EC2 instance.

   `setup-ec2.sh` prints the new instance's public IP and the SSH key path
   (`~/.ssh/clickforms-<env>.pem`) — keep both, you'll need them for §2 and §5.

   After provisioning, create the Infisical environment and machine identity and write the
   `INFISICAL_*` bootstrap to `/srv/clickforms/.env` as described in "Secrets from Infisical
   via `start.sh`" below.

## 2. GitHub Actions secrets

Set these in the repo (Settings → Secrets and variables → Actions), or via `gh secret set`:

| Secret | Value | Used by |
|---|---|---|
| `AWS_ROLE_ARN` | printed by `setup-github-oidc.sh` | `deploy-staging.yml` (OIDC login to push to ECR) |
| `STAGING_SSH_PRIVATE_KEY` | contents of `~/.ssh/clickforms-staging.pem` | `deploy-staging.yml` → `_deploy.yml` |
| `STAGING_HOST` | staging Elastic IP from `setup-ec2.sh` | same |
| `PRODUCTION_SSH_PRIVATE_KEY` | contents of `~/.ssh/clickforms-production.pem` | `promote-production.yml` → `_deploy.yml` |
| `PRODUCTION_HOST` | production Elastic IP from `setup-ec2.sh` | same |

`promote-production.yml` hardcodes the account ID in the ECR registry URL
(`385129731846.dkr.ecr.ap-southeast-2.amazonaws.com/clickforms`) since there's a single AWS
account for both environments — no OIDC login needed just to promote an existing tag.

## 3. DNS + TLS (Cloudflare)

DNS for `clickforms.com.au` is on Cloudflare (proxied / orange-clouded), nameservers
switched over at the registrar (Hostinger).

- `clickforms.com.au` and `*.clickforms.com.au` → A records at the **production** Elastic IP,
  proxied.
- `staging.clickforms.com.au` → A record at the **staging** Elastic IP, proxied.
- Cloudflare SSL/TLS mode: **Full (strict)**.
- Production uses a **Cloudflare Origin Certificate** (`Caddyfile.production`), not Let's
  Encrypt — Let's Encrypt's HTTP-01 challenge can't validate a wildcard hostname, and
  Cloudflare's free Universal SSL only covers the Cloudflare↔browser leg, not
  Cloudflare↔Caddy. Generate the cert once in the Cloudflare dashboard (SSL/TLS → Origin
  Server → Create Certificate; cover `clickforms.com.au` + `*.clickforms.com.au`, 15yr
  validity) and place it on the **production** box at:
  ```
  /srv/clickforms/certs/cloudflare-origin-cert.pem
  /srv/clickforms/certs/cloudflare-origin-key.pem
  ```
  This directory is **not created by any script and not committed** (gitignored) — it must
  be created and populated by hand on the box before the first deploy, or Caddy will fail
  to start (see Troubleshooting).
- Staging (`Caddyfile.staging`) serves `staging.clickforms.com.au` with a normal automatic
  Let's Encrypt certificate, and `<org>.staging.clickforms.com.au` (the links the app builds)
  with Caddy's on-demand TLS: one Let's Encrypt certificate per organisation subdomain, issued on
  first visit, only for subdomains of organisations that exist (`/tls-check`, called by Caddy over
  the docker network). Needs a `*.staging.clickforms.com.au` A record at the staging Elastic IP set
  to **DNS only** (grey cloud) in Cloudflare — Cloudflare's free certificate doesn't cover a
  two-level wildcard, so that traffic must reach Caddy directly.

## 4. Environment configuration — where each value lives

Three separate places, don't confuse them:

- **`/srv/clickforms/.env`** on each EC2 box (root-owned, mode 600, not in git) — only the
  bootstrap values; `ECR_IMAGE` is updated by every deploy:
  ```
  INFISICAL_CLIENT_ID=...
  INFISICAL_CLIENT_SECRET=...
  INFISICAL_PROJECT_ID=...
  INFISICAL_ENV=staging          # or prod
  ECR_IMAGE=<account>.dkr.ecr.ap-southeast-2.amazonaws.com/clickforms:<tag>
  ```

- **Infisical** (project `clickforms`, environments `dev` / `staging` / `prod`) holds every
  secret and setting: `DATABASE_URL`, `SESSION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`,
  `MESSAGEMEDIA_*`, `S3_BUCKET`, `ROOT_DOMAIN`, `CADDYFILE`, etc. `start.sh` fetches them at
  start (see "Secrets from Infisical via `start.sh`" below) and they are never baked into the
  image or written to disk.

- **`.env.local`** — local dev only, copy from `.env.example`. Never used in staging or
  production; production secrets never touch a `.env.local`-shaped file.

### Email (Resend) setup

One-time, per environment (staging and production can share a domain if you want the same
"from" address in both, or use a subdomain per environment — e.g. `staging.clickforms.com.au`
— to keep staging traffic out of production's sender reputation):

1. Create a Resend account and add the sending domain (e.g. `clickforms.com.au`) under
   **Domains**.
2. Resend gives you DNS records to add at your domain registrar/DNS provider (Cloudflare,
   per §3 of this doc) — an SPF `TXT` record, one or more DKIM `CNAME`/`TXT` records, and a
   `DMARC` `TXT` record if you don't already have one. Add all of them, then click "Verify"
   in Resend. Propagation is usually fast but can take a few hours.
3. Create an API key (**API Keys** → new key, scoped to "Sending access" and, if offered,
   restricted to the verified domain) and add it to the environment in Infisical as
   `RESEND_API_KEY`.
4. Add `RESEND_FROM=Clickforms <no-reply@clickforms.com.au>` (matching the verified
   domain, no quotes) to the same Infisical environment, then run
   `sudo /srv/clickforms/start.sh` on the box.

Until this is done, `sendEmail()` (`src/lib/email.ts`) just logs every email to the
container's stdout instead of sending — the app keeps working (signup/invite/reset links
still resolve, submission notifications still "send"), there's just no real delivery. Check
the `email_log` table (`EmailLog` model) for a `dev_logged`/`failed`/`sent` history per
attempt if delivery ever looks wrong after this is configured.

### SMS (MessageMedia) setup

One-time, per environment, for the live-form Share panel's "Send via SMS" action
(`src/lib/sms.ts`):

1. Create an account at [hub.messagemedia.com](https://hub.messagemedia.com/register) —
   MessageMedia has rebranded to **Sinch Engage**, so the signup flow is under that name
   now, but it's the same underlying Messages REST API.
2. Create an API key + secret pair (this is HTTP Basic Auth, not a single bearer token —
   the key is the username, the secret is the password) and add both to the environment in
   Infisical as `MESSAGEMEDIA_API_KEY` and `MESSAGEMEDIA_API_SECRET`.
3. Optionally set `MESSAGEMEDIA_SENDER_ID` in Infisical (a plain, non-secret
   value) if messages should show a name like
   `"Clickforms"` instead of a shared/numeric sender. An alphanumeric sender ID in
   Australia needs its own registration/approval with Sinch first — having API
   credentials alone isn't enough to send under a custom name.

Until this is done, `sendSms()` just logs every message to the container's stdout instead
of sending, same dev-mode convention as `sendEmail()`. Check the `sms_log` table (`SmsLog`
model) for a `dev_logged`/`failed`/`sent` history per attempt.

## 5. Day-to-day deploys

**Staging** — fully automatic. Push (or merge) to `main`:
1. `deploy-staging.yml` runs typecheck, lint, test.
2. Cross-builds a `linux/arm64` image via buildx+QEMU (GitHub runners are amd64; the app
   runs on `t4g.small`, which is arm64).
3. Pushes to ECR as `sha-<shortsha>`.
4. Calls the reusable `_deploy.yml`: scp's `docker-compose.yml` + `Caddyfile.staging` to the
   staging box, updates `ECR_IMAGE` in `/srv/clickforms/.env`, `docker compose pull && up -d`,
   then polls `https://staging.clickforms.com.au/health` for up to 2 minutes.

**Production** — manual, from an already-staging-deployed tag:
1. Go to Actions → **Promote to production** → Run workflow.
2. Enter the `image_tag` to promote (e.g. `sha-abc1234` — find it in the deploy-staging run
   you're promoting, or in the ECR console). This should be a tag that's already running
   cleanly on staging.
3. Same reusable deploy steps run against the production box, then health-checks
   `https://clickforms.com.au/health`.

No AWS credentials are used during the actual deploy step in either workflow — the target
EC2 box authenticates to ECR itself using its own instance role. OIDC is only used once, in
`deploy-staging.yml`'s build job, to push the image.

## 6. Database migrations

**There is no CI step that runs migrations.** `prisma migrate deploy` must be run by hand
against each environment's RDS instance whenever a new migration is added. This is the
current gap in the pipeline — treat it as a manual runbook step after every deploy that
includes a schema change, not something the deploy workflow handles for you.

RDS is not publicly reachable (EC2-security-group-only, per `setup-ec2.sh`), and the
production/staging Docker image doesn't bundle the Prisma CLI or `prisma.config.ts` (both
pruned from the traced standalone build). So migrations have to run *from inside* the EC2
box, in a throwaway container, not inside the running `clickforms-app` container. From an
SSH session on the target box:

```bash
sudo /srv/clickforms/migrate.sh
```

`migrate.sh` reads the same `.env` bootstrap as `start.sh` (Infisical credentials + `ECR_IMAGE`),
fetches `DATABASE_URL` from Infisical, copies `prisma/` out of the `ECR_IMAGE` image (always a
clean copy — `docker cp` into an existing directory nests instead of replacing, which once made
migrations look "already applied" on 2026-09-25) and runs `prisma migrate deploy` in a throwaway
`node:22` container. Set `ECR_IMAGE` in `.env` to the tag you are about to deploy first, and run
it **before** `start.sh` when the release contains a migration. It is safe to run with nothing
pending.

`node_modules` installed with `--no-save` persists in the bind-mounted `/tmp/migrate` across
separate `--rm` container runs, so subsequent migrations on the same box skip the reinstall —
the `rm -rf` above only targets `prisma/`, not the whole directory, to keep that benefit.
`/tmp/migrate` is a durable scratch workspace — safe to reuse for ad-hoc scripts too (see §7).

## 7. Creating admin users / organizations

Normal signup goes through `POST /api/auth/signup` (self-service, generates a unique
subdomain automatically). `prisma/seed.ts` is the idempotent local-dev seed
(`Default Organization` / `admin@example.local`) — never run it against staging or
production, it's dev-only.

For a one-off admin user in staging/production (e.g. smoke-testing after a deploy), there's
no built-in script — the pattern used so far is a throwaway Node script in `/tmp/migrate` on
the target box using the `pg` + `bcryptjs` packages, hashing the password with
`bcrypt.hash(password, 12)` to match `src/lib/auth.ts`'s own cost factor, and inserting
directly via SQL (organizations require a unique `subdomain`; users are
`@@unique([organizationId, email])`). This bypasses RLS because it runs as the RDS master
user, which is a Postgres superuser — see Known gotchas below. Treat any user created this
way as throwaway test data, not something to leave in production long-term.

## 8. Rollback

Both `deploy-staging.yml` and `promote-production.yml` ultimately call `_deploy.yml` with an
explicit `image` (staging: whatever it just built; production: whatever tag you pass in).
To roll back:
- **Production:** re-run **Promote to production** with the previous known-good `image_tag`.
- **Staging:** re-run `_deploy.yml`'s logic manually (or `workflow_dispatch` `deploy-staging.yml`
  won't help — it always builds the current `main`). Easiest is to SSH in, edit `ECR_IMAGE` in
  `/srv/clickforms/.env` back to the previous tag, and run `sudo docker compose pull && sudo docker compose up -d`.

`docker system prune -af` runs on every deploy (see `_deploy.yml`), so old image layers on
the box don't accumulate — but it also means you can't roll back to an old tag that's no
longer cached locally without re-pulling it from ECR (fine, since ECR tags are immutable and
never deleted except via the 7-day untagged-image lifecycle rule).

## 9. Known gotchas

- **`ROOT_DOMAIN` must be set in `docker-compose.yml`'s `app.environment` block.**
  `src/lib/tenant.ts` and `src/middleware.ts` both silently fall back to `localhost:3000`
  when it's unset. This isn't just cosmetic — `resolveOrganizationIdForSlugOrRedirect` uses
  it to build a real `redirect()` target for legacy/no-subdomain links, so a missing
  `ROOT_DOMAIN` sends real users' browsers to `http://<subdomain>.localhost:3000`. Confirm
  it's present with `docker compose exec app printenv ROOT_DOMAIN` after any deploy to a
  fresh box.

- **The S3 bucket's CORS policy needs a wildcard org-subdomain entry, not just the bare
  root domain.** Every public form is served from `<org-subdomain>.<root-domain>`
  (`src/middleware.ts`), and file/signature uploads PUT straight from the respondent's
  browser to S3 via a presigned URL — a cross-origin request S3 will silently reject
  (surfacing as a plain "Failed to fetch" in the browser, no server-side log) unless that
  exact `Origin` is in the bucket's `AllowedOrigins`. `scripts/s3-cors.json` must include
  both `https://<root-domain>` and `https://*.<root-domain>` per environment, and
  `put-bucket-cors` (via `scripts/setup-s3.sh`, or run by hand) has to be re-applied to the
  live bucket any time that file changes — editing the repo file alone does nothing to a
  bucket that was already provisioned. This isn't staging/production-only: local dev hits it
  too, since a public form still resolves to `<org-subdomain>.localhost:3000`
  (`resolveSubdomain` in `src/middleware.ts`), not bare `localhost:3000` — so
  `http://*.localhost:3000` needs to be in `AllowedOrigins` as well (added 2026-09-15). If
  uploads fail, check the actual applied policy first with
  `aws s3api get-bucket-cors --bucket <bucket> --region ap-southeast-2` — whichever bucket
  `S3_BUCKET` in the relevant `.env` points at (local dev commonly points at
  `clickforms-staging` rather than running a separate dev-only bucket).

- **`./certs` must exist and be populated on the production box before first deploy.**
  `Caddyfile.production` references `/etc/caddy/certs/cloudflare-origin-cert.pem` and
  `-key.pem`, mounted from `/srv/clickforms/certs` — nothing creates this directory or its
  contents automatically (see §3). Caddy fails to start without it. Staging doesn't need
  this (uses Let's Encrypt automatically).

- **RLS is currently bypassed in both environments.** `prisma/migrations/.../add_row_level_security`
  adds tenant-isolation policies keyed on `current_setting('app.current_org_id')`, but
  Postgres RLS is skipped entirely for superusers, and `DATABASE_URL` in both environments is
  still the RDS master account (created by `setup-rds.sh`) for both migrations *and* the
  app's runtime connection. Until a dedicated `NOSUPERUSER`/`NOBYPASSRLS` application role is
  created and `DATABASE_URL` points at it for the running app (reserving the master account
  for `prisma migrate deploy` only), RLS provides no actual protection — the app's own
  `withOrgContext` query-scoping is the only thing enforcing tenant isolation right now.

- **RDS requires an explicit TLS config in `db.ts`**, not just `sslmode` in the connection
  string — a bare `?sslmode=require` fails certificate verification against RDS's cert chain.

- **My sandbox has no route to RDS or the EC2 boxes.** Every command in §6 and §7 has to be
  run by a human with SSH access to the target box — there's no CI automation for either yet.

## 10. Quick reference

| | Staging | Production |
|---|---|---|
| Trigger | automatic, on push to `main` | manual, `workflow_dispatch` with `image_tag` |
| Domain | staging.clickforms.com.au | clickforms.com.au + \*.clickforms.com.au |
| TLS | Caddy automatic (Let's Encrypt) | Cloudflare Origin Certificate (`./certs`) |
| S3 bucket | clickforms-staging | clickforms-prod |
| Infisical env | `staging` | `prod` |
| RDS instance | clickforms-staging | clickforms-production |

## Secrets from Infisical via `start.sh`

The stack on each box is started with one command: `sudo /srv/clickforms/start.sh` (the deploy
workflow runs the same script). It:

1. reads `/srv/clickforms/.env`, which holds only the bootstrap values: `INFISICAL_CLIENT_ID`,
   `INFISICAL_CLIENT_SECRET`, `INFISICAL_PROJECT_ID`, `INFISICAL_ENV` (`staging` / `prod`),
   optionally `INFISICAL_URL` (only if the project isn't on the US cloud), and `ECR_IMAGE`
   (written by the deploy workflow);
2. fetches every secret and config value from that Infisical environment, using the app image's
   own `resolve-secrets.cjs` in a throwaway container;
3. exports them into its own environment and runs `docker compose pull && up -d`.

Nothing fetched is written to disk, and the Infisical credentials are not passed to the app
container. There is **no fallback**: if the credentials are missing or wrong, or Infisical is
unreachable, start.sh exits non-zero before touching the running containers and the problem
has to be fixed by hand (a failed deploy in GitHub Actions means exactly this).

Migrations: `sudo /srv/clickforms/migrate.sh` (same Infisical bootstrap, fetches `DATABASE_URL`
and runs `prisma migrate deploy`).

Infisical keys (project `clickforms`, environments `dev` / `staging` / `prod`): `ENVIRONMENT`,
`CADDYFILE`, `S3_BUCKET`, `ROOT_DOMAIN` (also used as `DOMAIN`), `NEXTAUTH_URL`, `AWS_REGION`,
`DATABASE_URL`, `SESSION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, optionally `CONTACT_EMAIL` and
the `MESSAGEMEDIA_*` trio. Never set `S3_ENDPOINT` outside local dev. Secrets reach the container
only if listed under `environment:` in `docker-compose.yml`, so adding a new one means editing both.

Migrating a box: one machine identity per environment (Universal Auth, Viewer on the project),
add the four `INFISICAL_*` lines to `.env`, add `ENVIRONMENT` and `CADDYFILE` to the Infisical
environment, then `sudo /srv/clickforms/start.sh`.

Rotating a secret: change it in Infisical, then `sudo /srv/clickforms/start.sh` (it recreates
the app container because its environment changed). Secrets are read only at start.

## Stripe billing

Code and design: `specs/08-billing.md`. Per environment:

1. Create the catalogue once per Stripe account (sandbox first, live at launch):
   `STRIPE_SECRET_KEY=sk_test_... yarn billing:setup-prices`. It prints the Customer Portal
   configuration id.
2. Add to that environment in Infisical, then redeploy (`sudo /srv/clickforms/start.sh`):
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_CONFIGURATION_ID`, and either
   `STRIPE_AUTOMATIC_TAX=true` (once GST registration is added in Stripe Tax) or
   `STRIPE_GST_TAX_RATE_ID` (an inclusive 10% GST tax rate). Test keys on `dev` and `staging`, live
   keys on `prod` only.
3. In the Stripe dashboard, add a webhook endpoint `https://<root domain>/api/billing/webhook`
   (staging: `https://staging.clickforms.com.au/api/billing/webhook`) for: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`. Its signing secret is `STRIPE_WEBHOOK_SECRET`.
4. Stripe dashboard settings: enable Smart Retries (retry for 14 days, then mark the subscription
   unpaid), turn on customer emails for receipts and failed payments, restrict subscription payment
   methods to cards, and add the ABN/GST registration under Tax settings.
5. Run the migration (`sudo /srv/clickforms/migrate.sh`) before the first deploy that contains
   billing; existing organisations stay on manual billing.

Local development: `stripe listen --forward-to localhost:3000/api/billing/webhook` prints the
webhook secret to use; with no `STRIPE_SECRET_KEY` set, billing is off and the free dev plan
switch is used.
