#!/usr/bin/env bash
# Runs one SQL statement against this box's database:
#   sudo /srv/clickforms/db-query.sh "select status, count(*) from email_logs group by 1"
#
# Same bootstrap as migrate.sh (INFISICAL_* + ECR_IMAGE from ./.env): fetches DATABASE_URL from
# Infisical and runs psql in a throwaway container. RDS is only reachable from inside the box's
# security group, which is why this runs here. Read-only by convention: use it for looking, and
# take a snapshot before running anything that changes data.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || exec sudo -E "$0" "$@"
cd "$(dirname "$(readlink -f "$0")")"

[ $# -ge 1 ] || { echo "usage: db-query.sh \"<sql>\"" >&2; exit 1; }
[ -f .env ] || { echo "db-query.sh: .env not found in $(pwd)" >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a

for name in INFISICAL_CLIENT_ID INFISICAL_CLIENT_SECRET INFISICAL_PROJECT_ID INFISICAL_ENV ECR_IMAGE; do
  [ -n "${!name:-}" ] || { echo "db-query.sh: $name is missing from .env" >&2; exit 1; }
done

SECRETS="$(docker run --rm --entrypoint node \
  -e INFISICAL_CLIENT_ID -e INFISICAL_CLIENT_SECRET -e INFISICAL_PROJECT_ID \
  -e INFISICAL_ENV -e INFISICAL_URL \
  "${ECR_IMAGE}" /app/resolve-secrets.cjs)"
set -a
eval "${SECRETS}"
set +a
unset SECRETS
[ -n "${DATABASE_URL:-}" ] || { echo "db-query.sh: DATABASE_URL missing from Infisical" >&2; exit 1; }

# psql rejects Prisma-style query parameters (e.g. ?schema=public); keep only the connection part.
PSQL_URL="${DATABASE_URL%%\?*}?sslmode=require"
docker run --rm -e PSQL_URL postgres:16-alpine sh -c 'psql "$PSQL_URL" -x -c "$0"' "$1"
