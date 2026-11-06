#!/bin/sh
set -eu

# Pulls runtime secrets from AWS SSM Parameter Store (SecureString) at container
# start (specs/00-infrastructure.md) so nothing secret is baked into the image or
# committed to this repo. Relies on the EC2 instance role for AWS credentials — no
# long-lived access keys anywhere on the box. Delegates to resolve-secrets.cjs
# (AWS SDK v3, not the `aws` CLI) — see that file's header and the Dockerfile's
# ssm-deps stage for why. Also resolves the optional resend-api-key parameter
# (DEPLOYMENT.md §4) into RESEND_API_KEY, when it's been provisioned.
#
# Stub for the scaffold stage: local dev never runs this (docker-compose.dev.yml only
# runs Postgres; the app itself runs natively via `yarn dev` against .env.local, no
# SSM involved). Wire up the real parameter names under SSM_PARAM_PREFIX once specs
# 04/05 need S3/SES and there's an actual parameter tree to read from.

# Secret source, in order:
#   1. start.sh already injected everything via the environment (SECRETS_INJECTED=1) — the
#      normal path on the boxes; nothing to fetch here.
#   2. Legacy: read SSM under SSM_PARAM_PREFIX (boxes not yet moved to start.sh/Infisical).
#   3. Neither: use the environment as-is (local dev).
if [ -n "${SECRETS_INJECTED:-}" ]; then
  echo "entrypoint: secrets injected by start.sh (Infisical)"
elif [ -n "${SSM_PARAM_PREFIX:-}" ]; then
  echo "entrypoint: resolving secrets from SSM under ${SSM_PARAM_PREFIX}"
  eval "$(node /app/ssm-deps/resolve-secrets.cjs)"
else
  echo "entrypoint: SSM_PARAM_PREFIX not set, using environment as-is (local/dev)"
fi

exec "$@"
