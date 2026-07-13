#!/usr/bin/env bash
# Creates the single ECR repository shared by both staging and production
# (specs/00-infrastructure.md: "ECR: one repository for the app image"). Both
# environments pull from this same repo, by different tags — build once, promote the
# same image, never rebuild per-environment (see .github/workflows/deploy-staging.yml
# and promote-production.yml).
#
# Usage:
#   ./scripts/setup-ecr.sh
#
# Requires: AWS CLI configured (same account/profile as scripts/setup-s3.sh / setup-rds.sh).
# Safe to re-run: skips creation if the repository already exists.

set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-2}"
REPO_NAME="${REPO_NAME:-clickforms}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "Account: ${ACCOUNT_ID}"
echo "Region:  ${REGION}"

if aws ecr describe-repositories --repository-names "${REPO_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  echo "==> ECR repository ${REPO_NAME} already exists — skipping creation."
else
  echo "==> Creating ECR repository ${REPO_NAME}..."
  aws ecr create-repository \
    --repository-name "${REPO_NAME}" \
    --image-scanning-configuration scanOnPush=true \
    --image-tag-mutability IMMUTABLE \
    --encryption-configuration EncryptionType=AES256 \
    --region "${REGION}" >/dev/null
fi

# Keep the repo from growing unbounded: expire untagged images (left behind by
# IMMUTABLE tag pushes that get superseded) after 7 days. Tagged images (the ones
# actually deployed or promotable) are never expired by this rule.
echo "==> Applying lifecycle policy (expire untagged images after 7 days)..."
aws ecr put-lifecycle-policy \
  --repository-name "${REPO_NAME}" \
  --lifecycle-policy-text '{
    "rules": [
      {
        "rulePriority": 1,
        "description": "Expire untagged images after 7 days",
        "selection": { "tagStatus": "untagged", "countType": "sinceImagePushed", "countUnit": "days", "countNumber": 7 },
        "action": { "type": "expire" }
      }
    ]
  }' \
  --region "${REGION}" >/dev/null

REPO_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"

cat <<EOF

Done.

  Repository: ${REPO_NAME}
  URI:        ${REPO_URI}

Next: scripts/setup-github-oidc.sh sets up keyless GitHub Actions access to push here,
then scripts/setup-ec2.sh gives each environment's EC2 instance role permission to pull
from it.
EOF
