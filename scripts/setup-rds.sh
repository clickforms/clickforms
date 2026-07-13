#!/usr/bin/env bash
# Creates the staging (or production) RDS Postgres instance, per specs/00-infrastructure.md's
# "RDS Postgres 16, encrypted, automated backups" plan, and stores the resulting connection
# string directly in SSM Parameter Store as a SecureString.
#
# The master password is generated locally with openssl and never printed to this terminal
# or typed by hand anywhere — it goes straight from this script into SSM. Retrieve it later
# with the `aws ssm get-parameter ... --with-decryption` command this script prints at the end.
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
SSM_PREFIX="/clickforms/${ENVIRONMENT}"

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
# entrypoint.sh reads secrets as {prefix}/database-url and {prefix}/session-secret
# (lowercase, hyphenated) — matching that exactly, not DATABASE_URL/SESSION_SECRET.
DB_URL_PARAM="${SSM_PREFIX}/database-url"
SESSION_SECRET_PARAM="${SSM_PREFIX}/session-secret"

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

# Only write DATABASE_URL to SSM if we just created the instance (so we know the real
# password) — re-running this script against an already-existing instance must NOT
# overwrite a working credential with a freshly-generated password that the DB doesn't
# actually have.
if [[ "${INSTANCE_EXISTS}" == false ]]; then
  DATABASE_URL="postgresql://${MASTER_USERNAME}:${MASTER_PASSWORD}@${ENDPOINT}:5432/${DB_NAME}"
  echo "==> Storing DATABASE_URL in SSM Parameter Store at ${DB_URL_PARAM}..."
  aws ssm put-parameter \
    --name "${DB_URL_PARAM}" \
    --value "${DATABASE_URL}" \
    --type SecureString \
    --overwrite \
    --region "${REGION}" >/dev/null
elif aws ssm get-parameter --name "${DB_URL_PARAM}" --region "${REGION}" >/dev/null 2>&1; then
  echo "==> SSM param ${DB_URL_PARAM} already present — leaving it as-is."
else
  echo
  echo "WARNING: instance ${DB_INSTANCE_ID} already existed but no DATABASE_URL is stored at" >&2
  echo "${DB_URL_PARAM}. This script cannot recover an existing master password. Reset it and" >&2
  echo "store the new value manually:" >&2
  echo "  aws rds modify-db-instance --db-instance-identifier ${DB_INSTANCE_ID} --master-user-password '<new-password>' --apply-immediately --region ${REGION}" >&2
  echo "  aws ssm put-parameter --name ${DB_URL_PARAM} --value 'postgresql://${MASTER_USERNAME}:<new-password>@${ENDPOINT}:5432/${DB_NAME}' --type SecureString --overwrite --region ${REGION}" >&2
fi

# App session secret — generated once per environment, same "don't clobber on re-run" rule
# (regenerating this invalidates every existing session for that environment).
if aws ssm get-parameter --name "${SESSION_SECRET_PARAM}" --region "${REGION}" >/dev/null 2>&1; then
  echo "==> SSM param ${SESSION_SECRET_PARAM} already present — leaving it as-is."
else
  echo "==> Generating SESSION_SECRET and storing at ${SESSION_SECRET_PARAM}..."
  aws ssm put-parameter \
    --name "${SESSION_SECRET_PARAM}" \
    --value "$(openssl rand -base64 48)" \
    --type SecureString \
    --overwrite \
    --region "${REGION}" >/dev/null
fi

cat <<EOF

Done.

  Instance:   ${DB_INSTANCE_ID} (${DB_INSTANCE_CLASS}, Postgres ${ENGINE_VERSION})
  Endpoint:   ${ENDPOINT}:5432
  Database:   ${DB_NAME}
  SSM params: ${DB_URL_PARAM}, ${SESSION_SECRET_PARAM} (SecureString)

Neither secret was ever printed here. Retrieve the DB URL later with:

  aws ssm get-parameter --name "${DB_URL_PARAM}" --with-decryption \\
    --query 'Parameter.Value' --output text --region ${REGION}

Next steps:
  1. Run migrations against this instance:
       DATABASE_URL="\$(aws ssm get-parameter --name ${DB_URL_PARAM} --with-decryption --query Parameter.Value --output text --region ${REGION})" \\
         yarn prisma migrate deploy
  2. Once the ${ENVIRONMENT} EC2 instance exists: swap the security group rule that allows
     your IP for one allowing only the EC2 instance's SG, and run
     'aws rds modify-db-instance --db-instance-identifier ${DB_INSTANCE_ID} --no-publicly-accessible --apply-immediately'.
  3. For the other environment, re-run with ENVIRONMENT=production (and consider a bigger
     DB_INSTANCE_CLASS if prod traffic warrants it).
EOF
