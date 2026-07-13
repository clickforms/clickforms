# Spec 00 — Infrastructure

Depends on: nothing (this is the foundation).
Blocks: everything else — no app code ships until this is reachable end-to-end.

## Goal

A single AWS account, one VPC in `ap-southeast-2`, running an empty "hello world" Next.js container over HTTPS, connected to an empty RDS Postgres instance, with CI/CD able to redeploy on push to `main`.

## Scope

- **VPC**: one VPC, one public subnet (EC2), one private subnet (RDS). Internet gateway on the public subnet only.
- **EC2**: one `t4g.small` (arm64, cheaper) instance, Docker + Docker Compose installed via user-data on boot. Elastic IP attached so the address survives instance replacement.
- **Security groups**: EC2 SG allows 22 (your IP only), 80/443 (0.0.0.0/0). RDS SG allows 5432 from the EC2 SG only — never public.
- **RDS**: Postgres 16, `db.t4g.micro` to start, 20GB storage, automated backups enabled (7-day retention minimum), encryption at rest on.
- **S3**: one private bucket, versioning off (not needed — we're not doing object-level recovery), default encryption on, bucket policy denies public access entirely.
- **IAM**: one instance role attached to the EC2 instance, with a policy scoped to: `s3:GetObject/PutObject/DeleteObject` on the one bucket, `ses:SendEmail`, nothing else. No IAM users with long-lived access keys anywhere.
- **SSM Parameter Store**: `DATABASE_URL`, `SESSION_SECRET`, and any other runtime secret as SecureString params, pulled by an entrypoint script at container start (not baked into the image).
- **Route53 + Caddy**: domain pointed at the Elastic IP; Caddy container handles automatic Let's Encrypt TLS.
- **ECR**: one repository for the app image.
- **CI/CD**: GitHub Actions workflow — on push to `main`: `corepack enable` → `yarn install --immutable` → `tsc --noEmit` + Biome check → build image → push to ECR → SSH to EC2 → `docker compose pull && docker compose up -d`.
- **CloudWatch**: default EC2/RDS metrics, one alarm on RDS storage and one on EC2 CPU as a smoke-test that alarms actually fire.

## Local development

Production uses RDS; local dev does **not** connect to it. Instead:

- **Postgres**: runs in Docker Desktop via `docker-compose.dev.yml`, pinned to the same major version as RDS (16), so migrations behave identically in both places. Named volume for persistence across restarts, port `5432` exposed to `localhost` only.
- **Package manager**: Yarn 4 (Berry) via Corepack — `corepack enable` once per machine, then `yarn install --immutable` for a lockfile-exact install (used both locally and in CI).
- **App**: runs natively (`yarn dev`), not containerized locally — hot reload is materially faster than rebuilding a container on every change. Docker is only used locally for the stateful service (Postgres), not the app itself.
- **Env**: `.env.local` (gitignored) holds `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/forms_dev` and a dev-only `SESSION_SECRET`. Never points at real SSM/AWS values.
- **S3/SES**: not needed to build/test the DB and auth layers. When file-upload or email work starts (specs 04/05), either point at a real but separate "dev" S3 bucket + SES sandbox, or stub those calls locally — decide when that spec starts, not now.
- **Migrations**: `yarn prisma migrate dev` against the local container during development; `yarn prisma migrate deploy` is what CI runs against RDS. Same migration files, two different targets — this is what guarantees local and prod schemas never drift.
- **Pre-commit**: Husky + lint-staged run Biome and `tsc --noEmit` on staged files — set this up as part of this spec, not left until later, so the habit is there from the first commit.

## Out of scope (defer to §11 of ARCHITECTURE.md)

Load balancer, multi-AZ EC2, ECS/Fargate, auto-scaling. Not needed at one org's internal usage.

## Acceptance criteria

- `curl https://forms.yourdomain.com/health` returns 200 over valid TLS.
- The health endpoint queries RDS (`SELECT 1`) and returns success, proving the app-to-DB path works end-to-end.
- Pushing to `main` results in the new image running on EC2 within a few minutes, with zero manual steps.
- SSH access requires a key, not a password; `nmap` or equivalent from an outside IP shows only 80/443 open.
- Deleting and recreating the EC2 instance (simulating a failure) does not lose data — RDS and S3 are unaffected, and re-running the Docker Compose deploy on a fresh instance brings the app back.
- `docker compose -f docker-compose.dev.yml up -d` followed by `yarn prisma migrate dev` and `yarn dev` gets a working local app against local Postgres with zero AWS credentials required.
- `yarn install --immutable` succeeds in CI (fails the build if the lockfile is out of sync with `package.json` — this is what makes CI installs deterministic).
- A staged file with a lint error or type error is blocked at commit time by the Husky pre-commit hook, not caught for the first time in CI.
