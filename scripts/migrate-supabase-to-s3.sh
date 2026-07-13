#!/usr/bin/env bash
# One-time copy of files from the Supabase Storage bucket (used as a stand-in S3-compatible
# provider while the real AWS account was blocked on signup — see src/lib/s3.ts / .env.example
# history) into the real AWS S3 bucket created by scripts/setup-s3.sh.
#
# Storage keys (org_id/form_id/submission_id/<uuid>-<filename> etc., see src/lib/s3.ts) are
# preserved exactly as-is — only the bucket location changes. Once this has run and you've
# verified the object count/spot-checked a few files, unset S3_ENDPOINT and point S3_BUCKET at
# the AWS bucket; no database changes are needed since submission_files.storage_key /
# organization_files.storage_key don't encode the bucket, just the key.
#
# Does a plain two-step sync (Supabase -> local temp dir -> AWS) rather than a direct
# bucket-to-bucket sync, since the AWS CLI's `s3 sync` only takes one --endpoint-url and these
# are two different S3-compatible endpoints with two different credential sets.
#
# Requires:
#   - AWS CLI installed and configured with your real AWS credentials as the DEFAULT profile
#     (the destination side of the sync — same credentials `aws configure` / setup-s3.sh use).
#   - Supabase Storage S3 credentials as a named profile, e.g.:
#       aws configure --profile supabase-storage
#     (Access key ID / secret from Storage > Settings > S3 Connection in the Supabase dashboard —
#     same ones you set as AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY when S3_ENDPOINT pointed here.)
#
# Usage:
#   SUPABASE_ENDPOINT="https://<project_ref>.storage.supabase.co/storage/v1/s3" \
#   SUPABASE_BUCKET="<supabase-bucket-name>" \
#   SUPABASE_PROFILE="supabase-storage" \
#   AWS_BUCKET="forms-prod-<account-id>" \
#     ./scripts/migrate-supabase-to-s3.sh
#
# Safe to re-run: `aws s3 sync` only copies new/changed objects each time.

set -euo pipefail

SUPABASE_ENDPOINT="${SUPABASE_ENDPOINT:?Set SUPABASE_ENDPOINT, e.g. https://<project_ref>.storage.supabase.co/storage/v1/s3}"
SUPABASE_BUCKET="${SUPABASE_BUCKET:?Set SUPABASE_BUCKET to the Supabase Storage bucket name}"
SUPABASE_PROFILE="${SUPABASE_PROFILE:-supabase-storage}"
AWS_BUCKET="${AWS_BUCKET:?Set AWS_BUCKET to the destination bucket created by scripts/setup-s3.sh}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

echo "Source:      s3://${SUPABASE_BUCKET} (${SUPABASE_ENDPOINT}, profile ${SUPABASE_PROFILE})"
echo "Destination: s3://${AWS_BUCKET} (real AWS, default profile)"
echo "Staging in:  ${TMP_DIR}"
echo

echo "==> Downloading from Supabase Storage..."
aws s3 sync "s3://${SUPABASE_BUCKET}" "${TMP_DIR}" \
  --profile "${SUPABASE_PROFILE}" \
  --endpoint-url "${SUPABASE_ENDPOINT}"

FILE_COUNT="$(find "${TMP_DIR}" -type f | wc -l | tr -d ' ')"
echo "==> Downloaded ${FILE_COUNT} objects."

echo "==> Uploading to AWS S3 (${AWS_BUCKET})..."
aws s3 sync "${TMP_DIR}" "s3://${AWS_BUCKET}"

cat <<EOF

Done. ${FILE_COUNT} objects synced from Supabase Storage to s3://${AWS_BUCKET}.

Next steps:
  1. Spot-check a few keys in the AWS console (or a submission's file field in the app,
     pointed temporarily at the new bucket) to confirm they open correctly.
  2. Update S3_BUCKET to "${AWS_BUCKET}" and unset S3_ENDPOINT in .env.local / prod SSM params.
  3. Once confirmed, this script is safe to re-run to pick up any files added to Supabase
     Storage in between (e.g. if the app kept taking uploads during migration) — then cut over.
  4. After cutover, the Supabase Storage bucket can be deleted whenever you're comfortable
     — nothing in the app reads from it once S3_ENDPOINT is unset.
EOF
