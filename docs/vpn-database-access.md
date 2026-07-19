# VPN, Database & SSH Access

How to reach staging/production RDS and EC2 from your laptop over the Client VPN. Written after the initial setup and a live debugging session on 2026-07-19.

## Architecture

Both environments share the account's single default VPC in `ap-southeast-2`:

- **VPC:** `vpc-0cfe14ddfe50866e7` (CIDR `172.31.0.0/16`)
- **Client VPN endpoint:** `cvpn-endpoint-0aa4eb62fe851d2cd`, client CIDR `10.100.0.0/22`
- **Target network association:** `subnet-03014722b7200cf14`, with security group `sg-0cee49ed230d92f54` attached to the endpoint's ENI in that subnet
- **VPN authorization rule:** allows the whole VPC (`172.31.0.0/16`)

Neither RDS instance is publicly accessible — `scripts/setup-ec2.sh` flips `--no-publicly-accessible` on once each environment's EC2 box exists, and swaps the RDS security group from "your IP" to SG-based rules. The only ways in are: the app's own EC2 instance, or a developer connected through the Client VPN.

### Important gotcha: Client VPN NATs your traffic

AWS Client VPN's auto-created route into the VPC has `"Type": "Nat"`. Practically: traffic reaching RDS does **not** appear to come from your `10.100.x.x` client IP — it's source-NAT'd to the private IP of the VPN endpoint's ENI in `subnet-03014722b7200cf14`. That ENI carries security group `sg-0cee49ed230d92f54`.

This means any security group you want VPN users to reach must allow **`sg-0cee49ed230d92f54` as a source** (not the `10.100.0.0/22` CIDR — that rule looks right but never actually matches VPN traffic). Both RDS security groups below already have this rule added.

## Connecting to the VPN

1. Use the **AWS VPN Client** app (not OpenVPN Connect — it hung indefinitely on DNS resolution for the wildcard `.ovpn` hostname; AWS's own client connects immediately with the same config).
2. Profile → Add Profile → point "VPN Configuration File" at `forms/.vpn/clients/mo/mo.ovpn` (gitignored, generated locally by `scripts/setup-client-vpn.sh` — never committed, embeds a private key).
3. Connect. Status should show green/"Connected" within a few seconds.

Keep it connected for any of the steps below — DBeaver, `psql`, and SSH by private IP all depend on the tunnel being up.

## Database access

| | Staging | Production |
|---|---|---|
| Endpoint | `clickforms-staging.cnae2w0sytxq.ap-southeast-2.rds.amazonaws.com` | `clickforms-production.cnae2w0sytxq.ap-southeast-2.rds.amazonaws.com` |
| Port | 5432 | 5432 |
| Database | `clickforms_staging` | `clickforms_production` |
| Username | `clickforms_admin` | `clickforms_admin` |
| RDS security group | `sg-0f23e168222db87c4` | `sg-0290a1592117aaf0a` |
| EC2 security group (app access) | `sg-0787a574b8e775f43` | `sg-02673b21617df6510` |
| SSM password param | `/clickforms/staging/database-url` | `/clickforms/production/database-url` |

Fetch the full connection string (never printed to chat/logs — pull it yourself):

```bash
DATABASE_URL=$(aws ssm get-parameter --name /clickforms/staging/database-url \
  --with-decryption --query Parameter.Value --output text --region ap-southeast-2)
# swap "staging" for "production" as needed
```

### Quick connectivity test

```bash
RDS_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier clickforms-staging \
  --query 'DBInstances[0].Endpoint.Address' --output text --region ap-southeast-2)
nc -zv -w 5 "$RDS_ENDPOINT" 5432
```

If this hangs (no `succeeded!`, no immediate refusal) with the VPN connected, the packet is being silently dropped — almost always the RDS SG missing the `sg-0cee49ed230d92f54` rule described above. Fix:

```bash
SG_ID=$(aws ec2 describe-security-groups --filters Name=group-name,Values=clickforms-staging-rds-sg \
  --query 'SecurityGroups[0].GroupId' --output text --region ap-southeast-2)
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 5432 \
  --source-group sg-0cee49ed230d92f54 --region ap-southeast-2
```

(Swap `clickforms-staging-rds-sg` for `clickforms-production-rds-sg` for prod.)

### psql

```bash
psql "${DATABASE_URL/sslmode=no-verify/sslmode=require}" -c "select 1;"
```

Note the substitution: the stored `DATABASE_URL` uses `sslmode=no-verify`, which is a **Prisma-specific** value (from the RDS TLS cert fix) — `psql`/libpq doesn't recognize it and errors with `invalid sslmode value`. `sslmode=require` is the libpq equivalent (encrypts, skips cert verification) and works fine for ad-hoc querying.

### DBeaver

1. New Database Connection → PostgreSQL
2. Host / Port / Database / Username from the table above
3. Password: extract from `echo "$DATABASE_URL"` locally — the segment between the `:` after the username and the `@` before the host
4. SSL tab → enable SSL → Mode: `require`
5. Test Connection — should succeed immediately if the `nc` test above already passed

**Production caution:** the staging and prod connections look identical side by side in DBeaver's connection list. Double-check which tab you're in before running anything, and treat any GUI session against prod as read-only unless you specifically mean to write.

## SSH access to EC2

Both instances have port 22 open to `0.0.0.0/0` — intentional, since GitHub Actions deploy runners have no stable IP and rely on key-based auth as the actual access control (see `scripts/setup-ec2.sh`). **Don't lock this down to VPN-only** or CI deploys will break.

Going through the VPN with private IPs is still the nicer path for interactive use (no dependency on the box's public reachability):

| | Staging | Production |
|---|---|---|
| Private IP | `172.31.27.222` | `172.31.23.17` |
| SSH key | `~/.ssh/clickforms-staging.pem` | `~/.ssh/clickforms-production.pem` |
| User | `ec2-user` | `ec2-user` |

Keys are created automatically by `scripts/setup-ec2.sh` if they don't already exist locally.

Add to `~/.ssh/config`:

```
Host clickforms-staging
    HostName 172.31.27.222
    User ec2-user
    IdentityFile ~/.ssh/clickforms-staging.pem

Host clickforms-production
    HostName 172.31.23.17
    User ec2-user
    IdentityFile ~/.ssh/clickforms-production.pem
```

Then, with the VPN connected:

```bash
ssh clickforms-staging
ssh clickforms-production
```

Private IPs can change if an instance is stopped/started (they're tied to the ENI, not guaranteed stable across a stop, though a running instance keeps the same one). If SSH by private IP stops working, re-fetch it:

```bash
aws ec2 describe-instances --filters "Name=tag:Name,Values=clickforms-staging" \
  "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text --region ap-southeast-2
```

## Troubleshooting checklist

If DB or SSH access stops working through the VPN:

1. Is the AWS VPN Client showing "Connected"? Reconnect if not.
2. `nc -zv -w 5 <endpoint> 5432` — hangs vs. immediate refusal vs. success tells you whether it's a security group problem (hang) or something else.
3. Does the RDS security group have an inbound rule sourced from `sg-0cee49ed230d92f54`? This is the one rule that's easy to forget when spinning up a new environment, because the obvious-looking `10.100.0.0/22` CIDR rule never actually matches (see the NAT explanation above).
4. `aws ec2 describe-client-vpn-target-networks` — confirm the association status is `associated`, not `associating` or failed.
5. `aws ec2 describe-client-vpn-routes` — confirm a route exists for `172.31.0.0/16` (or whatever the VPC's CIDR is).
