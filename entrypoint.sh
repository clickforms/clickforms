#!/bin/sh
set -eu

# Secrets are NOT fetched here. On the boxes, start.sh pulls them from Infisical and hands
# them to docker compose (SECRETS_INJECTED=1); this entrypoint only refuses to run the
# production image without them. Local dev never goes through this file (the app runs
# natively via `yarn dev` against .env.local).

if [ -z "${SECRETS_INJECTED:-}" ] && [ "${NODE_ENV:-}" = "production" ]; then
  echo "entrypoint: SECRETS_INJECTED is not set — start the stack with start.sh (see DEPLOYMENT.md)" >&2
  exit 1
fi

exec "$@"
