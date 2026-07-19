#!/usr/bin/env bash
# Creates a single AWS Client VPN endpoint into the account's default VPC (the same VPC
# that holds both the staging and production EC2/RDS instances — see
# scripts/setup-rds.sh / scripts/setup-ec2.sh), so a laptop can reach RDS directly without
# either instance being publicly accessible. Auth is mutual TLS: a private CA is generated
# locally, a server cert is issued from it and imported into ACM for the endpoint, and a
# client cert is issued per person and baked into their .ovpn config.
#
# This is shared infrastructure — ONE endpoint covers both staging and production, since
# they're both in the same default VPC. Per-environment isolation still comes from each
# RDS instance's own security group (clickforms-<env>-rds-sg): this script grants the VPN's
# client CIDR inbound 5432 on BOTH, but you could edit ENVIRONMENTS= below to grant only one.
#
# Nothing here is printed except ARNs/IDs — private keys never leave the local .vpn/
# directory (gitignored) except inside the per-client .ovpn file, which is also gitignored
# and must be handed to that person out-of-band (AirDrop, not Slack/email).
#
# Usage:
#   ./scripts/setup-client-vpn.sh                  # first run: CA + endpoint + client "mo"
#   CLIENT_NAME=jane ./scripts/setup-client-vpn.sh  # add another person later (reuses the CA/endpoint)
#
# Requires: AWS CLI configured (same account/profile as the other setup-*.sh scripts),
# openssl, and the AWS VPN Client app (https://aws.amazon.com/vpn/client-vpn-download/) on
# whichever machine will actually connect.
# Safe to re-run: skips creation of anything that already exists.

set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-2}"
CLIENT_CIDR="${CLIENT_CIDR:-10.100.0.0/22}"
CLIENT_NAME="${CLIENT_NAME:-mo}"
ENVIRONMENTS="${ENVIRONMENTS:-staging production}"
ENDPOINT_NAME="clickforms-vpn"
SSM_PREFIX="/clickforms/vpn"
OUT_DIR="${OUT_DIR:-.vpn}"

echo "==> Region:        ${REGION}"
echo "==> Client CIDR:   ${CLIENT_CIDR}"
echo "==> Client name:   ${CLIENT_NAME}"
echo "==> Environments:  ${ENVIRONMENTS}"
echo

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "Account: ${ACCOUNT_ID}"

VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text --region "${REGION}")"
if [[ "${VPC_ID}" == "None" || -z "${VPC_ID}" ]]; then
  echo "No default VPC found in ${REGION}." >&2
  exit 1
fi
VPC_CIDR="$(aws ec2 describe-vpcs --vpc-ids "${VPC_ID}" --query 'Vpcs[0].CidrBlock' --output text --region "${REGION}")"
SUBNET_ID="$(aws ec2 describe-subnets --filters Name=vpc-id,Values="${VPC_ID}" --query 'Subnets[0].SubnetId' --output text --region "${REGION}")"
echo "==> Using VPC ${VPC_ID} (${VPC_CIDR}), associating with subnet ${SUBNET_ID}"

mkdir -p "${OUT_DIR}/pki" "${OUT_DIR}/clients"

# --- Local CA: generated once, reused for every server/client cert issued after ------------
CA_KEY="${OUT_DIR}/pki/ca.key"
CA_CRT="${OUT_DIR}/pki/ca.crt"
if [[ -f "${CA_KEY}" && -f "${CA_CRT}" ]]; then
  echo "==> CA already exists at ${OUT_DIR}/pki/ — reusing."
else
  echo "==> Generating VPN CA (10-year self-signed)..."
  openssl req -x509 -newkey rsa:2048 -keyout "${CA_KEY}" -out "${CA_CRT}" \
    -days 3650 -nodes -subj "/CN=Clickforms VPN CA"
fi

# --- Server cert: issued from the CA, imported into ACM for the endpoint to present ---------
# ACM requires imported "server" certificates to carry a domain-shaped CN/SAN (a bare CN like
# "server" fails CreateClientVpnEndpoint with "does not have a domain") — the name below
# doesn't need to resolve to anything, it just needs to look like a hostname.
SERVER_CN="${SERVER_CN:-vpn.clickforms.internal}"
SERVER_CERT_ARN="$(aws ssm get-parameter --name "${SSM_PREFIX}/server-cert-arn" --query 'Parameter.Value' --output text --region "${REGION}" 2>/dev/null || true)"
if [[ -n "${SERVER_CERT_ARN}" && "${SERVER_CERT_ARN}" != "None" ]]; then
  echo "==> Server certificate already imported (${SERVER_CERT_ARN}) — reusing."
else
  echo "==> Issuing server certificate (CN=${SERVER_CN})..."
  openssl req -newkey rsa:2048 -keyout "${OUT_DIR}/pki/server.key" -out "${OUT_DIR}/pki/server.csr" \
    -nodes -subj "/CN=${SERVER_CN}"
  printf 'subjectAltName=DNS:%s\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n' "${SERVER_CN}" > "${OUT_DIR}/pki/server.ext"
  openssl x509 -req -in "${OUT_DIR}/pki/server.csr" -CA "${CA_CRT}" -CAkey "${CA_KEY}" \
    -CAcreateserial -out "${OUT_DIR}/pki/server.crt" -days 825 -extfile "${OUT_DIR}/pki/server.ext"

  echo "==> Importing server certificate into ACM..."
  SERVER_CERT_ARN="$(aws acm import-certificate \
    --certificate "fileb://${OUT_DIR}/pki/server.crt" \
    --private-key "fileb://${OUT_DIR}/pki/server.key" \
    --certificate-chain "fileb://${CA_CRT}" \
    --region "${REGION}" --query CertificateArn --output text)"
  aws ssm put-parameter --name "${SSM_PREFIX}/server-cert-arn" --value "${SERVER_CERT_ARN}" \
    --type String --overwrite --region "${REGION}" >/dev/null
fi

# --- Client root CA: the CA cert (+ its own key — this is how ACM's import API works even
# though the key is only used to validate, never to decrypt) imported so Client VPN can
# verify client certs presented during connection. ------------------------------------------
CLIENT_CA_ARN="$(aws ssm get-parameter --name "${SSM_PREFIX}/client-ca-cert-arn" --query 'Parameter.Value' --output text --region "${REGION}" 2>/dev/null || true)"
if [[ -n "${CLIENT_CA_ARN}" && "${CLIENT_CA_ARN}" != "None" ]]; then
  echo "==> Client root CA already imported (${CLIENT_CA_ARN}) — reusing."
else
  echo "==> Importing client root CA into ACM..."
  CLIENT_CA_ARN="$(aws acm import-certificate \
    --certificate "fileb://${CA_CRT}" \
    --private-key "fileb://${CA_KEY}" \
    --region "${REGION}" --query CertificateArn --output text)"
  aws ssm put-parameter --name "${SSM_PREFIX}/client-ca-cert-arn" --value "${CLIENT_CA_ARN}" \
    --type String --overwrite --region "${REGION}" >/dev/null
fi

# --- Client VPN endpoint ---------------------------------------------------------------------
ENDPOINT_ID="$(aws ssm get-parameter --name "${SSM_PREFIX}/endpoint-id" --query 'Parameter.Value' --output text --region "${REGION}" 2>/dev/null || true)"
if [[ -n "${ENDPOINT_ID}" && "${ENDPOINT_ID}" != "None" ]]; then
  echo "==> Client VPN endpoint already exists (${ENDPOINT_ID}) — reusing."
else
  echo "==> Creating Client VPN endpoint (mutual TLS, split-tunnel — only VPC traffic routes through the VPN)..."
  ENDPOINT_ID="$(aws ec2 create-client-vpn-endpoint \
    --client-cidr-block "${CLIENT_CIDR}" \
    --server-certificate-arn "${SERVER_CERT_ARN}" \
    --authentication-options "Type=certificate-authentication,MutualAuthentication={ClientRootCertificateChainArn=${CLIENT_CA_ARN}}" \
    --connection-log-options Enabled=false \
    --vpc-id "${VPC_ID}" \
    --split-tunnel \
    --tag-specifications "ResourceType=client-vpn-endpoint,Tags=[{Key=Name,Value=${ENDPOINT_NAME}}]" \
    --region "${REGION}" --query ClientVpnEndpointId --output text)"
  aws ssm put-parameter --name "${SSM_PREFIX}/endpoint-id" --value "${ENDPOINT_ID}" \
    --type String --overwrite --region "${REGION}" >/dev/null
fi

# --- Subnet association: gives the endpoint a foothold in the VPC; local routing then covers
# every other subnet in the same VPC automatically (that's why one association is enough). ---
ASSOC_STATE="$(aws ec2 describe-client-vpn-target-networks \
  --client-vpn-endpoint-id "${ENDPOINT_ID}" \
  --filters Name=target-network-id,Values="${SUBNET_ID}" \
  --query 'ClientVpnTargetNetworks[0].Status.Code' --output text --region "${REGION}" 2>/dev/null || true)"
if [[ "${ASSOC_STATE}" == "associated" || "${ASSOC_STATE}" == "associating" ]]; then
  echo "==> Subnet ${SUBNET_ID} already associated (${ASSOC_STATE})."
else
  echo "==> Associating subnet ${SUBNET_ID} (can take a minute or two)..."
  aws ec2 associate-client-vpn-target-network \
    --client-vpn-endpoint-id "${ENDPOINT_ID}" \
    --subnet-id "${SUBNET_ID}" \
    --region "${REGION}" >/dev/null
  echo "==> Waiting for association to become active..."
  until [[ "$(aws ec2 describe-client-vpn-target-networks \
    --client-vpn-endpoint-id "${ENDPOINT_ID}" \
    --filters Name=target-network-id,Values="${SUBNET_ID}" \
    --query 'ClientVpnTargetNetworks[0].Status.Code' --output text --region "${REGION}")" == "associated" ]]; do
    sleep 10
  done
fi

# --- Authorization rule: lets connected clients reach the whole VPC CIDR. Per-environment
# gating still happens at each RDS security group below, not here. --------------------------
RULE_EXISTS="$(aws ec2 describe-client-vpn-authorization-rules \
  --client-vpn-endpoint-id "${ENDPOINT_ID}" \
  --filters Name=destination-cidr,Values="${VPC_CIDR}" \
  --query 'AuthorizationRules[0].Status.Code' --output text --region "${REGION}" 2>/dev/null || true)"
if [[ "${RULE_EXISTS}" == "active" ]]; then
  echo "==> Authorization rule for ${VPC_CIDR} already active."
else
  echo "==> Authorizing connected clients to reach ${VPC_CIDR}..."
  aws ec2 authorize-client-vpn-ingress \
    --client-vpn-endpoint-id "${ENDPOINT_ID}" \
    --target-network-cidr "${VPC_CIDR}" \
    --authorize-all-groups \
    --region "${REGION}" >/dev/null
fi

# --- RDS security groups: allow the VPN client CIDR onto 5432 for each requested environment
for ENV in ${ENVIRONMENTS}; do
  RDS_SG_NAME="clickforms-${ENV}-rds-sg"
  RDS_SG_ID="$(aws ec2 describe-security-groups \
    --filters Name=group-name,Values="${RDS_SG_NAME}" Name=vpc-id,Values="${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' --output text --region "${REGION}" 2>/dev/null || true)"
  if [[ -z "${RDS_SG_ID}" || "${RDS_SG_ID}" == "None" ]]; then
    echo "==> WARNING: no security group named ${RDS_SG_NAME} found — skipping ${ENV}." >&2
    continue
  fi
  ALREADY_OPEN="$(aws ec2 describe-security-groups --group-ids "${RDS_SG_ID}" --region "${REGION}" \
    --query "SecurityGroups[0].IpPermissions[?ToPort==\`5432\`].IpRanges[?CidrIp=='${CLIENT_CIDR}'] | [0]" --output text)"
  if [[ -n "${ALREADY_OPEN}" && "${ALREADY_OPEN}" != "None" ]]; then
    echo "==> ${RDS_SG_NAME} already allows ${CLIENT_CIDR} on 5432."
  else
    echo "==> Allowing ${CLIENT_CIDR} onto 5432 in ${RDS_SG_NAME}..."
    aws ec2 authorize-security-group-ingress \
      --group-id "${RDS_SG_ID}" \
      --protocol tcp --port 5432 \
      --cidr "${CLIENT_CIDR}" \
      --region "${REGION}" >/dev/null
  fi
done

# --- Client cert + .ovpn config for CLIENT_NAME ----------------------------------------------
CLIENT_DIR="${OUT_DIR}/clients/${CLIENT_NAME}"
CLIENT_OVPN="${CLIENT_DIR}/${CLIENT_NAME}.ovpn"
if [[ -f "${CLIENT_OVPN}" ]]; then
  echo "==> ${CLIENT_OVPN} already exists — not regenerating (delete it first if you want a fresh cert)."
else
  mkdir -p "${CLIENT_DIR}"
  echo "==> Issuing client certificate for ${CLIENT_NAME}..."
  openssl req -newkey rsa:2048 -keyout "${CLIENT_DIR}/${CLIENT_NAME}.key" -out "${CLIENT_DIR}/${CLIENT_NAME}.csr" \
    -nodes -subj "/CN=${CLIENT_NAME}"
  openssl x509 -req -in "${CLIENT_DIR}/${CLIENT_NAME}.csr" -CA "${CA_CRT}" -CAkey "${CA_KEY}" \
    -CAcreateserial -out "${CLIENT_DIR}/${CLIENT_NAME}.crt" -days 825
  rm -f "${CLIENT_DIR}/${CLIENT_NAME}.csr"

  echo "==> Exporting base client config and embedding the cert/key (standard AWS Client VPN format)..."
  aws ec2 export-client-vpn-client-configuration \
    --client-vpn-endpoint-id "${ENDPOINT_ID}" \
    --region "${REGION}" --output text > "${CLIENT_OVPN}"
  {
    echo
    echo "<cert>"
    cat "${CLIENT_DIR}/${CLIENT_NAME}.crt"
    echo "</cert>"
    echo "<key>"
    cat "${CLIENT_DIR}/${CLIENT_NAME}.key"
    echo "</key>"
  } >> "${CLIENT_OVPN}"
fi

cat <<EOF

Done.

  Endpoint:       ${ENDPOINT_ID} (${ENDPOINT_NAME})
  Client CIDR:    ${CLIENT_CIDR}
  VPC:            ${VPC_ID} (${VPC_CIDR})
  RDS SGs opened: $(for ENV in ${ENVIRONMENTS}; do echo -n "clickforms-${ENV}-rds-sg "; done)
  Client config:  ${CLIENT_OVPN}

Next steps:
  1. Install the AWS VPN Client: https://aws.amazon.com/vpn/client-vpn-download/
  2. Import ${CLIENT_OVPN} into it (File > Manage Profiles > Add Profile) and connect.
  3. Once connected, point DBeaver at the RDS endpoint directly — no tunnel/bastion step:
       aws rds describe-db-instances --db-instance-identifier clickforms-staging \\
         --query 'DBInstances[0].Endpoint.Address' --output text --region ${REGION}
     (swap staging/production as needed). SSL mode: require.
  4. To add another person: CLIENT_NAME=<theirname> ./scripts/setup-client-vpn.sh — this
     reuses the existing CA/endpoint and only issues them a new cert. Hand them their .ovpn
     file out-of-band (AirDrop/USB, not Slack/email) since it embeds their private key.
  5. ${CA_KEY} is the whole trust root — back it up somewhere safe (password manager, not
     git) and treat losing it like losing root access to the VPN.

Cost: roughly \$0.05/connection-hour per connected person + ~\$0.10/subnet-association-hour
for the endpoint itself (billed whether or not anyone's connected). Associate additional
subnets only if you need HA across AZs — one is enough for a single developer's access.
EOF
