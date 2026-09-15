#!/usr/bin/env bash
# Creates an S3 bucket for file_upload/signature fields (specs/04-submission-handling.md)
# and form-branding logo uploads. Matches the bucket config specs/00-infrastructure.md calls
# for: private, versioning off, default encryption on, public access fully blocked — the app
# only ever talks to it via short-lived presigned URLs (src/lib/s3.ts), never a public ACL.
#
# Requires the AWS CLI configured with credentials that can create buckets in your account
# (e.g. `aws configure` or an SSO profile). Nothing here reads or writes secret keys — the
# CLI picks up whatever credentials are already active in your shell.
#
# Usage:
#   ENVIRONMENT=staging ./scripts/setup-s3.sh                 # bucket: clickforms-staging
#   ENVIRONMENT=production ./scripts/setup-s3.sh              # bucket: clickforms-prod (see note below)
#   AWS_REGION=us-east-1 ENVIRONMENT=staging ./scripts/setup-s3.sh   # override the default region
#   BUCKET=my-custom-name ./scripts/setup-s3.sh               # explicit override, skips ENVIRONMENT naming
#   ./scripts/setup-s3.sh                                     # neither set: dev bucket forms-dev-<account>

set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-2}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

# Matches setup-ec2.sh's S3_BUCKET_NAME derivation exactly — the production bucket is
# "clickforms-prod", not "clickforms-production" (kept short from when it was first
# created; changing it now would mean migrating existing objects). BUCKET= still wins
# outright when set, for anyone who needs a one-off custom name.
if [[ -z "${BUCKET:-}" ]]; then
  if [[ -n "${ENVIRONMENT:-}" ]]; then
    if [[ "${ENVIRONMENT}" == "production" ]]; then
      BUCKET="clickforms-prod"
    else
      BUCKET="clickforms-${ENVIRONMENT}"
    fi
  else
    BUCKET="forms-dev-${ACCOUNT_ID}"
  fi
fi

echo "Account:  ${ACCOUNT_ID}"
echo "Region:   ${REGION}"
echo "Bucket:   ${BUCKET}"
echo

echo "==> Creating bucket..."
if [ "${REGION}" = "us-east-1" ]; then
  # us-east-1 is the one region that rejects an explicit LocationConstraint.
  aws s3api create-bucket --bucket "${BUCKET}" --region "${REGION}"
else
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
fi

echo "==> Blocking all public access (access is presigned-URL only)..."
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo "==> Enabling default (SSE-S3) encryption..."
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

echo "==> Applying CORS (lets the browser PUT directly to S3 via a presigned URL)..."
aws s3api put-bucket-cors \
  --bucket "${BUCKET}" \
  --cors-configuration "file://$(dirname "$0")/s3-cors.json"

cat <<EOF

Done. Add to .env.local (dev) or the EC2 instance's SSM parameters (prod):

  S3_BUCKET="${BUCKET}"
  AWS_REGION="${REGION}"

Make sure S3_ENDPOINT is unset — the app defaults to real AWS S3 when it's empty.

scripts/s3-cors.json's AllowedOrigins must cover every origin a respondent's browser can send a
presigned PUT from — that means the wildcard org-subdomain form (e.g. https://*.clickforms.com.au),
not just the bare root domain, since every org's public form lives at <org-subdomain>.<root-domain>
(see src/middleware.ts). This applies to local dev too — testing a public form locally hits
<org-subdomain>.localhost:3000, not bare localhost:3000, so http://*.localhost:3000 is in the
list as well. If you add a new root domain, add both the bare and wildcard entries, then re-run:
  aws s3api put-bucket-cors --bucket ${BUCKET} --cors-configuration file://scripts/s3-cors.json

scripts/s3-iam-policy.json has the least-privilege policy to attach to the EC2 instance role
in production (specs/00-infrastructure.md §"IAM") — swap __BUCKET_NAME__ for "${BUCKET}"
(or your prod bucket name) and attach it to the instance profile the app container assumes.
No access keys needed in production — the instance role covers it. Local dev just uses
whatever AWS credentials are active in your shell.

If you have files already sitting in Supabase Storage from before the AWS account was
unblocked, copy them into this bucket with scripts/migrate-supabase-to-s3.sh before cutting
the app over.
EOF
