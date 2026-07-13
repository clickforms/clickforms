#!/usr/bin/env bash
# Creates one environment's EC2 instance per specs/00-infrastructure.md: Amazon Linux
# 2023 (arm64), Docker installed via user-data, Elastic IP, an instance role scoped to
# just that environment's S3 bucket / SSM path / ECR repo (no long-lived AWS keys on
# the box). Also reconciles the RDS security group created by setup-rds.sh: once this
# instance's SG exists, RDS access is switched from "your current IP" to "this EC2 SG
# only", and the DB is taken off public accessibility — matching the target architecture
# ("RDS is never internet-reachable").
#
# This script prepares the box (Docker, directories, static env values). It does NOT
# put docker-compose.yml/Caddyfile.* or the app image on the instance — that's what the
# first GitHub Actions deploy does (see .github/workflows/deploy-staging.yml /
# promote-production.yml), so the box is ready to receive a deploy the moment CI is set up.
#
# Usage:
#   ENVIRONMENT=staging ./scripts/setup-ec2.sh
#   ENVIRONMENT=production EC2_INSTANCE_TYPE=t4g.medium ./scripts/setup-ec2.sh
#
# Requires: AWS CLI configured (same account/profile as the other setup-*.sh scripts).
# Safe to re-run: skips creation of anything that already exists.

set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:?Set ENVIRONMENT to staging or production}"
REGION="${AWS_REGION:-ap-southeast-2}"
EC2_INSTANCE_TYPE="${EC2_INSTANCE_TYPE:-t4g.small}"
REPO_NAME="${REPO_NAME:-clickforms}"
KEY_NAME="clickforms-${ENVIRONMENT}"
SG_NAME="clickforms-${ENVIRONMENT}-ec2-sg"
ROLE_NAME="clickforms-${ENVIRONMENT}-ec2-role"
INSTANCE_PROFILE_NAME="clickforms-${ENVIRONMENT}-ec2-profile"
RDS_SG_NAME="clickforms-${ENVIRONMENT}-rds-sg"
RDS_INSTANCE_ID="clickforms-${ENVIRONMENT}"
TAG_NAME="clickforms-${ENVIRONMENT}"

# The production S3 bucket was created as "clickforms-prod" (see scripts/setup-s3.sh),
# not "clickforms-production" — keep that consistent here. Staging follows the plain
# clickforms-<environment> pattern. Override with S3_BUCKET_NAME= if yours differs.
if [[ -z "${S3_BUCKET_NAME:-}" ]]; then
  if [[ "${ENVIRONMENT}" == "production" ]]; then
    S3_BUCKET_NAME="clickforms-prod"
  else
    S3_BUCKET_NAME="clickforms-${ENVIRONMENT}"
  fi
fi

echo "==> Environment:      ${ENVIRONMENT}"
echo "==> Region:           ${REGION}"
echo "==> Instance type:    ${EC2_INSTANCE_TYPE}"
echo "==> S3 bucket:        ${S3_BUCKET_NAME}"
echo

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "Account: ${ACCOUNT_ID}"

VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text --region "${REGION}")"
if [[ "${VPC_ID}" == "None" || -z "${VPC_ID}" ]]; then
  echo "No default VPC found in ${REGION}." >&2
  exit 1
fi
SUBNET_ID="$(aws ec2 describe-subnets --filters Name=vpc-id,Values="${VPC_ID}" --query 'Subnets[0].SubnetId' --output text --region "${REGION}")"
echo "==> Using VPC ${VPC_ID}, subnet ${SUBNET_ID}"

# --- Security group: 22 from your IP only, 80/443 open (Caddy needs to answer ACME + traffic) --
SG_ID="$(aws ec2 describe-security-groups \
  --filters Name=group-name,Values="${SG_NAME}" Name=vpc-id,Values="${VPC_ID}" \
  --query 'SecurityGroups[0].GroupId' --output text --region "${REGION}" 2>/dev/null || true)"

if [[ -z "${SG_ID}" || "${SG_ID}" == "None" ]]; then
  echo "==> Creating security group ${SG_NAME}..."
  SG_ID="$(aws ec2 create-security-group \
    --group-name "${SG_NAME}" \
    --description "Clickforms ${ENVIRONMENT} EC2 access" \
    --vpc-id "${VPC_ID}" \
    --region "${REGION}" \
    --query 'GroupId' --output text)"

  # 0.0.0.0/0 rather than "your IP only": GitHub Actions-hosted runners (which SSH in
  # to deploy — see .github/workflows/_deploy.yml) have no stable IP, they're drawn from
  # a large, constantly-rotating range. Key-based auth (private key in the ssh_private_key
  # secret, no password auth) is the actual access control here, not source IP.
  echo "==> Allowing SSH (22) from anywhere (key-based auth only; CI runners have no stable IP)..."
  aws ec2 authorize-security-group-ingress --group-id "${SG_ID}" --protocol tcp --port 22 --cidr "0.0.0.0/0" --region "${REGION}" >/dev/null
  echo "==> Allowing HTTP (80) and HTTPS (443) from anywhere (Caddy + Let's Encrypt)..."
  aws ec2 authorize-security-group-ingress --group-id "${SG_ID}" --protocol tcp --port 80 --cidr "0.0.0.0/0" --region "${REGION}" >/dev/null
  aws ec2 authorize-security-group-ingress --group-id "${SG_ID}" --protocol tcp --port 443 --cidr "0.0.0.0/0" --region "${REGION}" >/dev/null
else
  echo "==> Security group ${SG_NAME} already exists (${SG_ID}), reusing."
fi

# --- Key pair: private key saved locally, never seen by anyone but you ---------------------
SSH_KEY_PATH="${HOME}/.ssh/${KEY_NAME}.pem"
if aws ec2 describe-key-pairs --key-names "${KEY_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  echo "==> Key pair ${KEY_NAME} already exists in AWS."
  if [[ ! -f "${SSH_KEY_PATH}" ]]; then
    echo "    (but ${SSH_KEY_PATH} isn't on this machine — if you don't have it saved" >&2
    echo "    elsewhere, delete the key pair in AWS and re-run this script to get a new one.)" >&2
  fi
else
  echo "==> Creating key pair ${KEY_NAME}, saving to ${SSH_KEY_PATH}..."
  aws ec2 create-key-pair --key-name "${KEY_NAME}" --query 'KeyMaterial' --output text --region "${REGION}" > "${SSH_KEY_PATH}"
  chmod 400 "${SSH_KEY_PATH}"
fi

# --- IAM instance role: scoped to this environment's bucket, SSM path, and ECR pull -------
TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": { "Service": "ec2.amazonaws.com" }, "Action": "sts:AssumeRole" }]
}'

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  echo "==> IAM role ${ROLE_NAME} already exists — reusing."
else
  echo "==> Creating IAM role ${ROLE_NAME}..."
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document "${TRUST_POLICY}" \
    --description "EC2 instance role for Clickforms ${ENVIRONMENT}" >/dev/null
fi

PERMISSIONS_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3AppObjectAccess",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::${S3_BUCKET_NAME}/*"
    },
    {
      "Sid": "SSMReadOwnParams",
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters"],
      "Resource": "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/clickforms/${ENVIRONMENT}/*"
    },
    {
      "Sid": "SSMDecrypt",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": { "StringEquals": { "kms:ViaService": "ssm.${REGION}.amazonaws.com" } }
    },
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "ECRPull",
      "Effect": "Allow",
      "Action": ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"],
      "Resource": "arn:aws:ecr:${REGION}:${ACCOUNT_ID}:repository/${REPO_NAME}"
    },
    {
      "Sid": "SES",
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
EOF
)

echo "==> Attaching instance permissions (S3 ${S3_BUCKET_NAME} only, SSM /clickforms/${ENVIRONMENT}/* only, ECR pull, SES)..."
aws iam put-role-policy --role-name "${ROLE_NAME}" --policy-name "clickforms-${ENVIRONMENT}-app-access" --policy-document "${PERMISSIONS_POLICY}" >/dev/null

if aws iam get-instance-profile --instance-profile-name "${INSTANCE_PROFILE_NAME}" >/dev/null 2>&1; then
  echo "==> Instance profile ${INSTANCE_PROFILE_NAME} already exists — reusing."
else
  echo "==> Creating instance profile ${INSTANCE_PROFILE_NAME}..."
  aws iam create-instance-profile --instance-profile-name "${INSTANCE_PROFILE_NAME}" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "${INSTANCE_PROFILE_NAME}" --role-name "${ROLE_NAME}" >/dev/null
  echo "==> Waiting for instance profile to propagate..."
  sleep 10
fi

# --- AMI: latest Amazon Linux 2023, arm64 ---------------------------------------------------
AMI_ID="$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-*-arm64" "Name=state,Values=available" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text --region "${REGION}")"
echo "==> AMI: ${AMI_ID} (Amazon Linux 2023, arm64)"

# --- Root volume: default AMI size (8GB) is too small — the app image alone bundles
# Chromium for the PDF-export feature (see Dockerfile) and runs well past 8GB once
# Caddy's image and Docker's own layer overhead are added, especially across repeated
# deploys where old sha-tagged layers accumulate. 30GB gp3 is cheap (~$2.40/mo) headroom.
ROOT_DEVICE_NAME="$(aws ec2 describe-images --image-ids "${AMI_ID}" --query 'Images[0].RootDeviceName' --output text --region "${REGION}")"
EC2_ROOT_VOLUME_SIZE="${EC2_ROOT_VOLUME_SIZE:-30}"

# --- Domain for this environment (used only in the final DNS instructions below) ------------
if [[ "${ENVIRONMENT}" == "production" ]]; then
  DOMAIN_NAME="clickforms.com.au"
else
  DOMAIN_NAME="staging.clickforms.com.au"
fi

# --- User-data: prepares the box, does not deploy the app -----------------------------------
CADDYFILE_NAME="Caddyfile.${ENVIRONMENT}"
USER_DATA_FILE="$(mktemp)"
cat > "${USER_DATA_FILE}" <<USERDATA
#!/bin/bash
set -euo pipefail
dnf update -y
dnf install -y docker
systemctl enable --now docker
usermod -aG docker ec2-user

# Docker Compose v2 plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -sL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64" \\
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

mkdir -p /opt/clickforms
cat > /opt/clickforms/.env <<ENVFILE
ENVIRONMENT=${ENVIRONMENT}
CADDYFILE=${CADDYFILE_NAME}
AWS_REGION=${REGION}
S3_BUCKET=${S3_BUCKET_NAME}
ENVFILE

echo "clickforms-${ENVIRONMENT} box ready for first deploy" > /opt/clickforms/READY
USERDATA

# --- Launch instance (or reuse an existing one tagged for this environment) ---------------
EXISTING_INSTANCE_ID="$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${TAG_NAME}" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text --region "${REGION}" 2>/dev/null || true)"

if [[ -n "${EXISTING_INSTANCE_ID}" && "${EXISTING_INSTANCE_ID}" != "None" ]]; then
  echo "==> Instance already exists (${EXISTING_INSTANCE_ID}) — skipping creation."
  INSTANCE_ID="${EXISTING_INSTANCE_ID}"
else
  echo "==> Launching EC2 instance..."
  INSTANCE_ID="$(aws ec2 run-instances \
    --image-id "${AMI_ID}" \
    --instance-type "${EC2_INSTANCE_TYPE}" \
    --key-name "${KEY_NAME}" \
    --security-group-ids "${SG_ID}" \
    --subnet-id "${SUBNET_ID}" \
    --iam-instance-profile "Name=${INSTANCE_PROFILE_NAME}" \
    --user-data "file://${USER_DATA_FILE}" \
    --block-device-mappings "[{\"DeviceName\":\"${ROOT_DEVICE_NAME}\",\"Ebs\":{\"VolumeSize\":${EC2_ROOT_VOLUME_SIZE},\"VolumeType\":\"gp3\"}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${TAG_NAME}}]" \
    --query 'Instances[0].InstanceId' --output text --region "${REGION}")"

  echo "==> Waiting for instance ${INSTANCE_ID} to be running..."
  aws ec2 wait instance-running --instance-ids "${INSTANCE_ID}" --region "${REGION}"
fi
rm -f "${USER_DATA_FILE}"

# --- Elastic IP: allocate + associate (or reuse one already tagged for this environment) --
EIP_ALLOC_ID="$(aws ec2 describe-addresses \
  --filters "Name=tag:Name,Values=${TAG_NAME}" \
  --query 'Addresses[0].AllocationId' --output text --region "${REGION}" 2>/dev/null || true)"

if [[ -z "${EIP_ALLOC_ID}" || "${EIP_ALLOC_ID}" == "None" ]]; then
  echo "==> Allocating Elastic IP..."
  EIP_ALLOC_ID="$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text --region "${REGION}")"
  aws ec2 create-tags --resources "${EIP_ALLOC_ID}" --tags "Key=Name,Value=${TAG_NAME}" --region "${REGION}" >/dev/null
else
  echo "==> Reusing existing Elastic IP allocation ${EIP_ALLOC_ID}."
fi

aws ec2 associate-address --instance-id "${INSTANCE_ID}" --allocation-id "${EIP_ALLOC_ID}" --region "${REGION}" >/dev/null
PUBLIC_IP="$(aws ec2 describe-addresses --allocation-ids "${EIP_ALLOC_ID}" --query 'Addresses[0].PublicIp' --output text --region "${REGION}")"

# --- Reconcile RDS: switch from "your IP" access to "this EC2 SG only", go private --------
echo
echo "==> Reconciling ${RDS_SG_NAME} to allow only this instance's security group..."
RDS_SG_ID="$(aws ec2 describe-security-groups \
  --filters Name=group-name,Values="${RDS_SG_NAME}" Name=vpc-id,Values="${VPC_ID}" \
  --query 'SecurityGroups[0].GroupId' --output text --region "${REGION}" 2>/dev/null || true)"

if [[ -z "${RDS_SG_ID}" || "${RDS_SG_ID}" == "None" ]]; then
  echo "    ${RDS_SG_NAME} not found — run scripts/setup-rds.sh for this environment first, then re-run this script." >&2
else
  # Revoke any CIDR-based (your-IP) rules on 5432, replace with EC2-SG-based access.
  CIDR_RULES="$(aws ec2 describe-security-groups --group-ids "${RDS_SG_ID}" \
    --query "SecurityGroups[0].IpPermissions[?ToPort==\`5432\`].IpRanges[].CidrIp" --output text --region "${REGION}" 2>/dev/null || true)"
  for CIDR in ${CIDR_RULES}; do
    echo "    Revoking old IP-based rule (${CIDR})..."
    aws ec2 revoke-security-group-ingress --group-id "${RDS_SG_ID}" --protocol tcp --port 5432 --cidr "${CIDR}" --region "${REGION}" >/dev/null || true
  done

  ALREADY_ALLOWED="$(aws ec2 describe-security-groups --group-ids "${RDS_SG_ID}" \
    --query "SecurityGroups[0].IpPermissions[?ToPort==\`5432\`].UserIdGroupPairs[?GroupId=='${SG_ID}'].GroupId" --output text --region "${REGION}" 2>/dev/null || true)"
  if [[ -z "${ALREADY_ALLOWED}" ]]; then
    echo "    Allowing 5432 from ${SG_NAME} (${SG_ID})..."
    aws ec2 authorize-security-group-ingress --group-id "${RDS_SG_ID}" --protocol tcp --port 5432 --source-group "${SG_ID}" --region "${REGION}" >/dev/null
  fi

  echo "==> Setting ${RDS_INSTANCE_ID} to not publicly accessible..."
  aws rds modify-db-instance --db-instance-identifier "${RDS_INSTANCE_ID}" --no-publicly-accessible --apply-immediately --region "${REGION}" >/dev/null || \
    echo "    (couldn't modify — RDS instance may not exist yet for this environment, that's fine)" >&2
fi

cat <<EOF

Done.

  Instance:    ${INSTANCE_ID} (${EC2_INSTANCE_TYPE}, ${AMI_ID})
  Public IP:   ${PUBLIC_IP}
  SSH:         ssh -i ${SSH_KEY_PATH} ec2-user@${PUBLIC_IP}
  Role:        ${ROLE_NAME} (S3: ${S3_BUCKET_NAME} only, SSM: /clickforms/${ENVIRONMENT}/* only, ECR pull, SES)

Next steps:
  1. Point DNS at this IP:
       ${DOMAIN_NAME} -> ${PUBLIC_IP} (A record)
  2. Add this instance's SSH private key as a GitHub Actions secret so CI can deploy to it:
       gh secret set $(echo ${ENVIRONMENT} | tr '[:lower:]' '[:upper:]')_SSH_PRIVATE_KEY < ${SSH_KEY_PATH} --repo <org>/<repo>
       gh secret set $(echo ${ENVIRONMENT} | tr '[:lower:]' '[:upper:]')_HOST --body "${PUBLIC_IP}" --repo <org>/<repo>
  3. Repeat for the other environment: ENVIRONMENT=$( [ "${ENVIRONMENT}" = "production" ] && echo staging || echo production ) ./scripts/setup-ec2.sh
  4. Once .github/workflows/deploy-staging.yml (or promote-production.yml) exists and both
     secrets above are set, pushing to main (or promoting) will scp docker-compose.yml +
     Caddyfile.${ENVIRONMENT} to /opt/clickforms on this box and bring the app up.
EOF
