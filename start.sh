#!/usr/bin/env bash
# Starts (or redeploys) the stack on an EC2 box:  sudo /srv/clickforms/start.sh
#
# Reads ONLY the bootstrap values from ./.env (INFISICAL_* credentials + ECR_IMAGE, which
# the deploy workflow writes), fetches every real secret and config value from Infisical,
# and hands them to `docker compose` through the environment of this one process. Nothing
# fetched is ever written to disk. The deploy workflow calls this script too, so there is a
# single way the stack starts.
#
# No fallback: if Infisical can't be reached or the credentials are wrong this exits
# non-zero before touching the running containers, and it has to be fixed by hand.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || exec sudo -E "$0" "$@"
cd "$(dirname "$(readlink -f "$0")")"

[ -f .env ] || { echo "start.sh: .env not found in $(pwd)" >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a

for name in INFISICAL_CLIENT_ID INFISICAL_CLIENT_SECRET INFISICAL_PROJECT_ID INFISICAL_ENV ECR_IMAGE; do
  [ -n "${!name:-}" ] || { echo "start.sh: $name is missing from .env" >&2; exit 1; }
done

# Fetch with the app image itself: it already contains resolve-secrets.cjs (tested, no
# host dependencies like jq). Credentials go in by name (-e NAME), so they never appear in
# a process listing, and are NOT passed on to the app container.
if ! docker image inspect "${ECR_IMAGE}" >/dev/null 2>&1; then
  # Not on the box yet (e.g. start.sh run by hand before the deploy workflow's ECR login).
  REGISTRY="${ECR_IMAGE%%/*}"
  REGION="$(echo "${REGISTRY}" | cut -d. -f4)"
  aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${REGISTRY}"
  docker pull "${ECR_IMAGE}"
fi
echo "start.sh: fetching secrets from Infisical (${INFISICAL_ENV})"
SECRETS="$(docker run --rm --entrypoint node \
  -e INFISICAL_CLIENT_ID -e INFISICAL_CLIENT_SECRET -e INFISICAL_PROJECT_ID \
  -e INFISICAL_ENV -e INFISICAL_URL \
  "${ECR_IMAGE}" /app/resolve-secrets.cjs)"

set -a
eval "${SECRETS}"
set +a
unset SECRETS INFISICAL_CLIENT_SECRET

# compose needs DOMAIN; Infisical keeps it as ROOT_DOMAIN.
export DOMAIN="${DOMAIN:-${ROOT_DOMAIN:-}}"
# Tells entrypoint.sh the secrets are already in the environment — skip the check.
export SECRETS_INJECTED=1

docker compose pull
docker compose up -d --remove-orphans

# Caddy reads its Caddyfile only when its container starts, and a deploy replaces the file
# without touching the container — so recreate Caddy whenever the file's contents changed.
# (Certificates live in the caddy_data volume and survive this; it's a few seconds of restart.)
CADDY_FILE="${CADDYFILE:-Caddyfile.production}"
NEW_SUM="$(sha256sum "${CADDY_FILE}" | cut -d' ' -f1)"
if [ "$(cat .caddyfile.sha 2>/dev/null || true)" != "${NEW_SUM}" ]; then
  echo "start.sh: ${CADDY_FILE} changed — recreating Caddy"
  docker compose up -d --force-recreate caddy
  echo "${NEW_SUM}" > .caddyfile.sha
fi
echo "start.sh: done"
