#!/usr/bin/env bash
# Applies pending database migrations:  sudo /srv/clickforms/migrate.sh
#
# Uses the same bootstrap as start.sh (INFISICAL_* + ECR_IMAGE from ./.env): fetches
# DATABASE_URL from Infisical, copies the prisma/ directory (schema + migrations) out of the
# SAME image that is about to run, and runs `prisma migrate deploy` in a throwaway container.
# RDS is only reachable from inside the box's security group, which is why this runs here.
# Run it BEFORE start.sh when a release contains a migration. Safe to run when nothing is pending.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || exec sudo -E "$0" "$@"
cd "$(dirname "$(readlink -f "$0")")"

[ -f .env ] || { echo "migrate.sh: .env not found in $(pwd)" >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a

for name in INFISICAL_CLIENT_ID INFISICAL_CLIENT_SECRET INFISICAL_PROJECT_ID INFISICAL_ENV ECR_IMAGE; do
  [ -n "${!name:-}" ] || { echo "migrate.sh: $name is missing from .env" >&2; exit 1; }
done

if ! docker image inspect "${ECR_IMAGE}" >/dev/null 2>&1; then
  REGISTRY="${ECR_IMAGE%%/*}"
  REGION="$(echo "${REGISTRY}" | cut -d. -f4)"
  aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${REGISTRY}"
  docker pull "${ECR_IMAGE}"
fi

echo "migrate.sh: fetching DATABASE_URL from Infisical (${INFISICAL_ENV})"
SECRETS="$(docker run --rm --entrypoint node \
  -e INFISICAL_CLIENT_ID -e INFISICAL_CLIENT_SECRET -e INFISICAL_PROJECT_ID \
  -e INFISICAL_ENV -e INFISICAL_URL \
  "${ECR_IMAGE}" /app/resolve-secrets.cjs)"
set -a
eval "${SECRETS}"
set +a
unset SECRETS
[ -n "${DATABASE_URL:-}" ] || { echo "migrate.sh: DATABASE_URL missing from Infisical" >&2; exit 1; }

WORK=/tmp/migrate
mkdir -p "${WORK}"
# Always a clean copy: `docker cp` into an existing directory nests instead of replacing, which
# once made migrations look "already applied" (see DEPLOYMENT.md §6). node_modules is reused.
rm -rf "${WORK}/prisma"
CID="$(docker create "${ECR_IMAGE}")"
docker cp "${CID}:/app/prisma" "${WORK}/prisma"
docker rm "${CID}" >/dev/null

cat > "${WORK}/prisma.config.ts" <<'CONFIG'
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
CONFIG

echo "migrate.sh: applying pending migrations"
docker run --rm -v "${WORK}:/app" -w /app -e DATABASE_URL \
  node:22-bookworm-slim bash -c "
    apt-get update -qq && apt-get install -y --no-install-recommends openssl -qq &&
    npm install prisma@7.8.0 --no-save --silent &&
    npx prisma migrate deploy
  "
echo "migrate.sh: done"
