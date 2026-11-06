#!/usr/bin/env bash
# Creates the staging (or production) RDS Postgres instance, per specs/00-infrastructure.md's
# "RDS Postgres 16, encrypted, automated backups" plan.
#
# The master password is generated locally with openssl. The resulting DATABASE_URL is shown
# exactly once, when the instance is first created (copied to the macOS clipboard if pbcopy
# exists, otherwise printed): paste it straight into the environment's Infisical secrets as
# DATABASE_URL. It is not stored anywhere else — if you lose it, reset the master password
# with `aws rds modify-db-instance --master-user-password ...` and update Infisical.
#
# NOTE on networking: this creates the RDS security group open to *your current IP only*
# (not 0.0.0.0/0), so you can connect directly and run migrations before any EC2 instance
# exists. specs/00-infrastructure.md's target state is RDS reachable *only* from the EC2
# security group, never publicly. Once the environment's EC2 instance exists, re-run
# `aws ec2 revoke-security-group-ingress` on your IP rule, add a rule for the EC2 SG instead,
# and set --no-publicly-accessible via `aws rds modify-db-instance`. Track that as a
# follow-up — don't leave a staging or prod DB publicly reachable indefinitely.
#
# Usage:
#   ENVIRONMENT=staging ./scripts/setup-rds.sh
#   ENVIRONMENT=production DB_INSTANCE_CLASS=db.t4g.small ./scripts/setup-rds.sh
#
# Requires: AWS CLI configured (same account/profile used for scripts/setup-s3.sh).
# Safe to re-run: skips creation of anything that already exists.

set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:?Set ENVIRONMENT to staging or production}"
REGION="${AWS_REGION:-ap-southeast-2}"
DB_INSTANCE_CLASS="${DB_INSTANCE_CLASS:-db.t4g.micro}"
DB_ALLOCATED_STORAGE="${DB_ALLOCATED_STORAGE:-20}"
# specs/00-infrastructure.md calls for 7-day retention minimum, but some newer/free-tier
# AWS accounts cap this lower — override with BACKUP_RETENTION_DAYS=1 (or whatever your
# account allows) if create-db-instance errors with FreeTierRestrictionError, then raise it
# once the account's free-tier limitations lift.
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DB_INSTANCE_ID="clickforms-${ENVIRONMENT}"
DB_NAME="clickforms_${ENVIRONMENT}"
MASTER_USERNAME="clickforms_admin"

echo "==> Environment:     ${ENVIRONMENT}"
echo "==> Region:          ${REGION}"
echo "==> Instance class:  ${DB_INSTANCE_CLASS}"
echo "==> Instance id:     ${DB_INSTANCE_ID}"
echo

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "Account: ${ACCOUNT_ID}"

# --- Networking: security group + DB subnet group off the account's default VPC -----------
VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text --region "${REGION}")"
if [[ "${VPC_ID}" == "None" || -z "${VPC_ID}" ]]; then
  echo "No default VPC found in ${REGION}. This script uses the account's default VPC for" >&2
  echo "simplicity while EC2 doesn't exist yet — create/select a VPC first if you don't have one." >&2
  exit 1
fi
echo "==> Using VPC: ${VPC_ID}"

SUBNET_IDS="$(aws ec2 describe-subnets --filters Name=vpc-id,Values="${VPC_ID}" --query 'Subnets[].SubnetId' --output text --region "${REGION}")"
SUBNET_GROUP_NAME="clickforms-${ENVIRONMENT}-subnets"

if ! aws rds describe-db-subnet-groups --db-subnet-group-name "${SUBNET_GROUP_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  echo "==> Creating DB subnet group ${SUBNET_GROUP_NAME}..."
  aws rds create-db-subnet-group \
    --db-subnet-group-name "${SUBNET_GROUP_NAME}" \
    --db-subnet-group-description "Clickforms ${ENVIRONMENT} RDS subnets" \
    --subnet-ids ${SUBNET_IDS} \
    --region "${REGION}" >/dev/null
else
  echo "==> DB subnet group ${SUBNET_GROUP_NAME} already exists, reusing."
fi

SG_NAME="clickforms-${ENVIRONMENT}-rds-sg"
SG_ID="$(aws ec2 describe-security-groups \
  --filters Name=group-name,Values="${SG_NAME}" Name=vpc-id,Values="${VPC_ID}" \
  --query 'SecurityGroups[0].GroupId' --output text --region "${REGION}" 2>/dev/null || true)"

if [[ -z "${SG_ID}" || "${SG_ID}" == "None" ]]; then
  echo "==> Creating security group ${SG_NAME}..."
  SG_ID="$(aws ec2 create-security-group \
    --group-name "${SG_NAME}" \
    --description "Clickforms ${ENVIRONMENT} RDS access" \
    --vpc-id "${VPC_ID}" \
    --region "${REGION}" \
    --query 'GroupId' --output text)"

  MY_IP="$(curl -s https://checkip.amazonaws.com)"
  echo "==> Allowing inbound 5432 from your current IP (${MY_IP}/32) — temporary, until EC2 exists..."
  aws ec2 authorize-security-group-ingress \
    --group-id "${SG_ID}" \
    --protocol tcp --port 5432 \
    --cidr "${MY_IP}/32" \
    --region "${REGION}" >/dev/null
else
  echo "==> Security group ${SG_NAME} already exists (${SG_ID}), reusing."
fi

# --- Master password: generated locally, never typed or displayed -------------------------
MASTER_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-32)"

# --- Engine version: latest available Postgres 16.x, resolved dynamically -----------------
ENGINE_VERSION="$(aws rds describe-db-engine-versions \
  --engine postgres \
  --query "sort_by(DBEngineVersions[?starts_with(EngineVersion, '16.')], &EngineVersion)[-1].EngineVersion" \
  --output text --region "${REGION}")"
echo "==> Postgres engine version: ${ENGINE_VERSION}"

# --- RDS instance ---------------------------------------------------------------------------
INSTANCE_EXISTS=false
if aws rds describe-db-instances --db-instance-identifier "${DB_INSTANCE_ID}" --region "${REGION}" >/dev/null 2>&1; then
  INSTANCE_EXISTS=true
  echo "==> RDS instance ${DB_INSTANCE_ID} already exists — skipping creation."
else
  echo "==> Creating RDS instance ${DB_INSTANCE_ID} (this takes several minutes)..."
  aws rds create-db-instance \
    --db-instance-identifier "${DB_INSTANCE_ID}" \
    --db-name "${DB_NAME}" \
    --engine postgres \
    --engine-version "${ENGINE_VERSION}" \
    --db-instance-class "${DB_INSTANCE_CLASS}" \
    --allocated-storage "${DB_ALLOCATED_STORAGE}" \
    --storage-type gp3 \
    --master-username "${MASTER_USERNAME}" \
    --master-user-password "${MASTER_PASSWORD}" \
    --vpc-security-group-ids "${SG_ID}" \
    --db-subnet-group-name "${SUBNET_GROUP_NAME}" \
    --backup-retention-period "${BACKUP_RETENTION_DAYS}" \
    --storage-encrypted \
    --publicly-accessible \
    --no-multi-az \
    --region "${REGION}" >/dev/null

  echo "==> Waiting for instance to become available (this can take 5-10+ minutes)..."
  aws rds wait db-instance-available --db-instance-identifier "${DB_INSTANCE_ID}" --region "${REGION}"
fi

ENDPOINT="$(aws rds describe-db-instances \
  --db-instance-identifier "${DB_INSTANCE_ID}" \
  --query 'DBInstances[0].Endpoint.Address' --output text --region "${REGION}")"

# The password is only known when we just created the instance — re-running this script
# against an existing instance cannot recover it (and must not invent a new one).
if [[ "${INSTANCE_EXISTS}" == false ]]; then
  DATABASE_URL="postgresql://${MASTER_USERNAME}:${MASTER_PASSWORD}@${ENDPOINT}:5432/${DB_NAME}"
  if command -v pbcopy >/dev/null 2>&1; then
    printf '%s' "${DATABASE_URL}" | pbcopy
    echo "==> DATABASE_URL copied to your clipboard — paste it into Infisical now (${ENVIRONMENT} → DATABASE_URL)."
  else
    echo "==> DATABASE_URL (shown once — paste it into Infisical as DATABASE_URL):"
    echo "${DATABASE_URL}"
  fi
else
  echo
  echo "NOTE: instance ${DB_INSTANCE_ID} already existed, so its master password is unknown here." >&2
  echo "If you need a new one, reset it and update DATABASE_URL in Infisical:" >&2
  echo "  aws rds modify-db-instance --db-instance-identifier ${DB_INSTANCE_ID} --master-user-password '<new-password>' --apply-immediately --region ${REGION}" >&2
fi

cat <<EOF

Done.

  Instance:   ${DB_INSTANCE_ID} (${DB_INSTANCE_CLASS}, Postgres ${ENGINE_VERSION})
  Endpoint:   ${ENDPOINT}:5432
  Database:   ${DB_NAME}

Next steps:
  1. Add to the "${ENVIRONMENT}" environment in Infisical (project clickforms):
       DATABASE_URL    (see above; append ?sslmode=no-verify)
       SESSION_SECRET  (generate with: openssl rand -base64 48)
  2. Once the ${ENVIRONMENT} EC2 instance exists and its Infisical identity is set up, run
     migrations on the box: sudo /srv/clickforms/migrate.sh
  3. Once the ${ENVIRONMENT} EC2 instance exists: swap the security group rule that allows
     your IP for one allowing only the EC2 instance's SG, and run
     'aws rds modify-db-instance --db-instance-identifier ${DB_INSTANCE_ID} --no-publicly-accessible --apply-immediately'.
  4. For the other environment, re-run with ENVIRONMENT=production (and consider a bigger
     DB_INSTANCE_CLASS if prod traffic warrants it).
EOF
