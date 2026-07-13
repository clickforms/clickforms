#!/usr/bin/env bash
# One-time remediation for RDS instances provisioned by an older version of
# setup-rds.sh, which stored the connection string as uppercase DATABASE_URL and
# never wrote a session-secret param. entrypoint.sh reads lowercase, hyphenated
# names (database-url, session-secret) — see entrypoint.sh's fetch_param(). This
# script copies DATABASE_URL to database-url, deletes the old uppercase param, and
# creates session-secret if it's missing. Safe to re-run.
#
# Usage:
#   ENVIRONMENT=staging ./scripts/fix-ssm-param-names.sh
#   ENVIRONMENT=production ./scripts/fix-ssm-param-names.sh

set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:?Set ENVIRONMENT to staging or production}"
REGION="${AWS_REGION:-ap-southeast-2}"
SSM_PREFIX="/clickforms/${ENVIRONMENT}"

OLD_PARAM="${SSM_PREFIX}/DATABASE_URL"
NEW_PARAM="${SSM_PREFIX}/database-url"
SESSION_SECRET_PARAM="${SSM_PREFIX}/session-secret"

echo "==> Environment: ${ENVIRONMENT}"

if aws ssm get-parameter --name "${NEW_PARAM}" --region "${REGION}" >/dev/null 2>&1; then
  echo "==> ${NEW_PARAM} already exists — nothing to migrate."
elif aws ssm get-parameter --name "${OLD_PARAM}" --with-decryption --region "${REGION}" >/dev/null 2>&1; then
  echo "==> Migrating ${OLD_PARAM} -> ${NEW_PARAM}..."
  VALUE="$(aws ssm get-parameter --name "${OLD_PARAM}" --with-decryption --query 'Parameter.Value' --output text --region "${REGION}")"
  aws ssm put-parameter --name "${NEW_PARAM}" --value "${VALUE}" --type SecureString --overwrite --region "${REGION}" >/dev/null
  aws ssm delete-parameter --name "${OLD_PARAM}" --region "${REGION}" >/dev/null
  echo "==> Done. Deleted old uppercase param."
else
  echo "WARNING: neither ${OLD_PARAM} nor ${NEW_PARAM} exists — nothing to migrate." >&2
fi

if aws ssm get-parameter --name "${SESSION_SECRET_PARAM}" --region "${REGION}" >/dev/null 2>&1; then
  echo "==> ${SESSION_SECRET_PARAM} already exists — leaving it as-is."
else
  echo "==> Creating ${SESSION_SECRET_PARAM}..."
  aws ssm put-parameter --name "${SESSION_SECRET_PARAM}" --value "$(openssl rand -base64 48)" --type SecureString --overwrite --region "${REGION}" >/dev/null
fi

echo
echo "Done. ${SSM_PREFIX} now has database-url and session-secret, matching entrypoint.sh."
