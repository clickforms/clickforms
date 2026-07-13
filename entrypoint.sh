#!/bin/sh
set -eu

# Pulls runtime secrets from AWS SSM Parameter Store (SecureString) at container
# start (specs/00-infrastructure.md) so nothing secret is baked into the image or
# committed to this repo. Relies on the EC2 instance role for AWS credentials — no
# long-lived access keys anywhere on the box.
#
# Stub for the scaffold stage: local dev never runs this (docker-compose.dev.yml only
# runs Postgres; the app itself runs natively via `yarn dev` against .env.local, no
# SSM involved). Wire up the real parameter names under SSM_PARAM_PREFIX once specs
# 04/05 need S3/SES and there's an actual parameter tree to read from.

fetch_param() {
  aws ssm get-parameter \
    --name "${SSM_PARAM_PREFIX}/$1" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text \
    --region "${AWS_REGION}"
}

if [ -n "${SSM_PARAM_PREFIX:-}" ]; then
  echo "entrypoint: resolving secrets from SSM under ${SSM_PARAM_PREFIX}"
  export DATABASE_URL="$(fetch_param database-url)"
  export SESSION_SECRET="$(fetch_param session-secret)"
else
  echo "entrypoint: SSM_PARAM_PREFIX not set, using environment as-is (local/dev)"
fi

exec "$@"
