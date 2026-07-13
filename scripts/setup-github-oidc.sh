#!/usr/bin/env bash
# Sets up keyless AWS access for GitHub Actions: an IAM OIDC identity provider trusting
# token.actions.githubusercontent.com, plus an IAM role CI assumes via that token —
# no long-lived AWS access keys stored as GitHub secrets (consistent with
# specs/00-infrastructure.md: "No IAM users with long-lived access keys anywhere").
#
# The trust policy is scoped to one specific GitHub repo (and, optionally, branch) so
# only workflows running in that repo can assume the role.
#
# Usage:
#   GITHUB_ORG=your-org GITHUB_REPO=forms ./scripts/setup-github-oidc.sh
#
# Requires: AWS CLI configured (same account/profile as the other setup-*.sh scripts).
# Safe to re-run: skips creation of anything that already exists.

set -euo pipefail

GITHUB_ORG="${GITHUB_ORG:?Set GITHUB_ORG to your GitHub username/org, e.g. GITHUB_ORG=mo}"
GITHUB_REPO="${GITHUB_REPO:?Set GITHUB_REPO to the repo name, e.g. GITHUB_REPO=forms}"
REGION="${AWS_REGION:-ap-southeast-2}"
ROLE_NAME="${ROLE_NAME:-github-actions-clickforms}"
REPO_NAME="${REPO_NAME:-clickforms}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
OIDC_PROVIDER_URL="token.actions.githubusercontent.com"
OIDC_PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_PROVIDER_URL}"

echo "Account:      ${ACCOUNT_ID}"
echo "GitHub repo:  ${GITHUB_ORG}/${GITHUB_REPO}"
echo

# --- OIDC provider (one per AWS account, shared by all repos/roles) -----------------------
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "${OIDC_PROVIDER_ARN}" >/dev/null 2>&1; then
  echo "==> OIDC provider for ${OIDC_PROVIDER_URL} already exists — reusing."
else
  echo "==> Creating OIDC provider for ${OIDC_PROVIDER_URL}..."
  # GitHub's OIDC thumbprint — AWS validates the token signature itself, so this is
  # effectively a required-but-unused legacy field for well-known providers, per AWS docs.
  aws iam create-open-id-connect-provider \
    --url "https://${OIDC_PROVIDER_URL}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" >/dev/null
fi

# --- IAM role, trusted only by workflows running in this exact repo -----------------------
TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "${OIDC_PROVIDER_ARN}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": { "${OIDC_PROVIDER_URL}:aud": "sts.amazonaws.com" },
        "StringLike": { "${OIDC_PROVIDER_URL}:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:*" }
      }
    }
  ]
}
EOF
)

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  echo "==> Role ${ROLE_NAME} already exists — updating trust policy."
  aws iam update-assume-role-policy --role-name "${ROLE_NAME}" --policy-document "${TRUST_POLICY}" >/dev/null
else
  echo "==> Creating role ${ROLE_NAME}..."
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document "${TRUST_POLICY}" \
    --description "Assumed by GitHub Actions in ${GITHUB_ORG}/${GITHUB_REPO} to push images to ECR" >/dev/null
fi

# --- Permissions: push/pull this one ECR repo, nothing else -------------------------------
PERMISSIONS_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "ECRPushPull",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:${REGION}:${ACCOUNT_ID}:repository/${REPO_NAME}"
    }
  ]
}
EOF
)

echo "==> Attaching ECR push/pull policy scoped to repository '${REPO_NAME}'..."
aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "ecr-push-pull" \
  --policy-document "${PERMISSIONS_POLICY}" >/dev/null

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

cat <<EOF

Done.

  Role ARN: ${ROLE_ARN}

Add this as a GitHub Actions secret so the workflows in
.github/workflows/deploy-staging.yml and promote-production.yml can assume it:

  gh secret set AWS_ROLE_ARN --body "${ROLE_ARN}" --repo ${GITHUB_ORG}/${GITHUB_REPO}

(or add it manually: repo Settings → Secrets and variables → Actions → New repository secret)

This role can only push/pull the '${REPO_NAME}' ECR repository and only when the token
comes from a workflow running in ${GITHUB_ORG}/${GITHUB_REPO} — nothing else.
EOF
