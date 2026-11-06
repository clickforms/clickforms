#!/usr/bin/env bash
# Starts (or redeploys) the stack on an EC2 box:  sudo /srv/clickforms/start.sh
#
# Reads ONLY the bootstrap values from ./.env (INFISICAL_* credentials + ECR_IMAGE, which
# the deploy workflow writes), fetches every real secret and config value from Infisical,
# and hands them to `docker compose` through the environment of this one process. Nothing
# fetched is ever written to disk. The deploy workflow calls this script too, so there is a
# single way the stack starts.
#
# If INFISICAL_CLIENT_ID is not set in .env, falls back to the old behaviour (plain
# `docker compose`, container reads SSM itself) so an un-migrated box keeps working.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || exec sudo -E "$0" "$@"
cd "$(dirname "$(readlink -f "$0")")"

[ -f .env ] || { echo "start.sh: .env not found in $(pwd)" >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "${INFISICAL_CLIENT_ID:-}" ]; then
  echo "start.sh: INFISICAL_CLIENT_ID not set — starting in legacy SSM mode"
  docker compose pull
  docker compose up -d --remove-orphans
  exit 0
fi

for name in INFISICAL_CLIENT_SECRET INFISICAL_PROJECT_ID INFISICAL_ENV ECR_IMAGE; do
  [ -n "${!name:-}" ] || { echo "start.sh: $name is missing from .env" >&2; exit 1; }
done

# Fetch with the app image itself: it already contains resolve-secrets.cjs (tested, no
# host dependencies like jq). Credentials go in by name (-e NAME), so they never appear in
# a process listing, and are NOT passed on to the app container.
docker image inspect "${ECR_IMAGE}" >/dev/null 2>&1 || docker pull "${ECR_IMAGE}"
echo "start.sh: fetching secrets from Infisical (${INFISICAL_ENV})"
SECRETS="$(docker run --rm --entrypoint node \
  -e INFISICAL_CLIENT_ID -e INFISICAL_CLIENT_SECRET -e INFISICAL_PROJECT_ID \
  -e INFISICAL_ENV -e INFISICAL_URL \
  "${ECR_IMAGE}" /app/ssm-deps/resolve-secrets.cjs)"

set -a
eval "${SECRETS}"
set +a
unset SECRETS INFISICAL_CLIENT_SECRET

# compose needs DOMAIN; Infisical keeps it as ROOT_DOMAIN.
export DOMAIN="${DOMAIN:-${ROOT_DOMAIN:-}}"
# Tells entrypoint.sh the secrets are already in the environment — skip SSM.
export SECRETS_INJECTED=1

docker compose pull
docker compose up -d --remove-orphans
echo "start.sh: done"
