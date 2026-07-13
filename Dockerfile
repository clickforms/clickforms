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
# prisma.config.ts calls env('DATABASE_URL') at load time, which runs on every `prisma
# generate` call — including the "postinstall" hook that `yarn install` fires below.
# Build-time-only placeholder — generate never connects to it, it just needs to parse
# as a Postgres URL. The real DATABASE_URL is injected at container start by
# entrypoint.sh from SSM, not baked into the image.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
# The postinstall hook needs prisma/schema.prisma to exist, so it has to be copied in
# before `yarn install` runs, not just in the builder stage's later `COPY . .`.
COPY prisma ./prisma
RUN node .yarn/releases/yarn-4.17.1.cjs install --immutable

# ---- builder: generate the Prisma client and produce the Next.js standalone build ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
# ENV doesn't carry across FROM boundaries, and COPY . . below causes yarn to
# re-validate/re-link the dependency tree against the freshly-copied source (same
# postinstall/build scripts as the deps stage run again) — so this needs to be
# re-declared here too, or puppeteer's postinstall tries to download Chrome again
# and fails, which cascades into breaking `next build`'s TypeScript resolution.
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node .yarn/releases/yarn-4.17.1.cjs prisma:generate
RUN node .yarn/releases/yarn-4.17.1.cjs build

# ---- ssm-deps: isolated install for entrypoint's two SSM GetParameter calls ----
# Previously this used the apt `awscli` package, on the theory that the CLI alone was
# lighter than pulling in the full AWS SDK. In practice awscli's Debian package drags in
# a whole Python runtime (python3 + docutils + sgml-base, ~150-250MB with
# --no-install-recommends) just to run `aws ssm get-parameter` twice. @aws-sdk/client-ssm
# is pure JS with no native bindings (~15-20MB with transitive deps) — installed here in
# its own throwaway node_modules, completely separate from the app's yarn dependency
# tree, so it can't interact with the postinstall/prisma-generate machinery above.
FROM node:22-bookworm-slim AS ssm-deps
WORKDIR /app
RUN npm install --omit=dev @aws-sdk/client-ssm@^3.700.0

# ---- runtime: minimal image containing only what `node server.js` needs ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# `chromium` + `fonts-freefont-ttf` give the submission-PDF-export feature
# (src/lib/forms/generate-submission-pdf.ts) a real headless browser to drive —
# Puppeteer's own bundled-Chrome download is skipped above, so without this the
# PDF export route fails at runtime with "Could not find Chrome". Chromium can't be
# swapped for an Alpine-based image to save space here — see the glibc/Prisma note
# at the top of this file; we're stuck on Debian either way.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-freefont-ttf \
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

# Kept under ./ssm-deps/, not ./node_modules — the standalone COPY above already
# populated ./node_modules with Next's own trimmed bundle, and copying here would
# have clobbered it. Placing resolve-secrets.cjs alongside its node_modules means
# plain `require()` resolution finds @aws-sdk/client-ssm without any NODE_PATH hacks.
COPY --from=ssm-deps /app/node_modules ./ssm-deps/node_modules
COPY resolve-secrets.cjs ./ssm-deps/resolve-secrets.cjs

USER nextjs

EXPOSE 3000

# Container-level self-report, complementary to (not a replacement for) the external
# curl-against-the-real-domain check in .github/workflows/_deploy.yml — that one proves
# TLS/Caddy/DNS all work end-to-end, this one lets `docker ps` / orchestrators see
# per-container health without going through the network. Uses Node's own http client
# rather than adding a curl/wget package, since node is already here and the whole
# point of this stage is staying minimal.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
