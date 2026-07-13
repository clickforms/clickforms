# syntax=docker/dockerfile:1
#
# Multi-stage build targeting arm64 (t4g.small, per ARCHITECTURE.md §3/§10). The
# `node:22-bookworm-slim` base is deliberate over `-alpine`: Prisma's engine binaries
# are built against glibc + OpenSSL 3.x ("linux-arm64-openssl-3.0.x"), which matches
# Debian bookworm; Alpine's musl libc has historically been a source of Prisma engine
# mismatches that are easy to avoid by not using it.

# ---- deps: install dependencies only, cached separately from source changes ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Skip Puppeteer's own Chrome-for-Testing download: it doesn't reliably ship
# linux-arm64 builds, and this image targets arm64 (t4g.small). We install a
# system Chromium via apt in the runtime stage instead (see PUPPETEER_EXECUTABLE_PATH
# below) and point Puppeteer at it.
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN node .yarn/releases/yarn-4.17.1.cjs install --immutable

# ---- builder: generate the Prisma client and produce the Next.js standalone build ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
# prisma.config.ts calls env('DATABASE_URL') at load time, which runs on every `prisma
# generate` call below. Build-time-only placeholder — generate never connects to it,
# it just needs to parse as a Postgres URL. The real DATABASE_URL is injected at
# container start by entrypoint.sh from SSM, not baked into the image.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node .yarn/releases/yarn-4.17.1.cjs prisma:generate
RUN node .yarn/releases/yarn-4.17.1.cjs build

# ---- runtime: minimal image containing only what `node server.js` needs ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# AWS CLI is needed by entrypoint.sh to pull secrets from SSM Parameter Store at
# container start (specs/00-infrastructure.md) — kept to just the CLI, not the full
# SDK, to minimize image size.
#
# `chromium` + `fonts-freefont-ttf` give the submission-PDF-export feature
# (src/lib/forms/generate-submission-pdf.ts) a real headless browser to drive —
# Puppeteer's own bundled-Chrome download is skipped above, so without this the
# PDF export route fails at runtime with "Could not find Chrome".
RUN apt-get update \
  && apt-get install -y --no-install-recommends awscli chromium fonts-freefont-ttf \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Non-root user — the EC2 instance role already scopes AWS permissions narrowly; a
# container running as root is an unnecessary second privilege boundary to lose.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
