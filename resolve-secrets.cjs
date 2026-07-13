#!/usr/bin/env node
'use strict';

// Fetches runtime secrets from SSM Parameter Store and prints `export KEY='value'`
// lines for entrypoint.sh to `eval`. Uses @aws-sdk/client-ssm (installed into its own
// node_modules by the Dockerfile's ssm-deps stage — see the comment there) instead of
// the `aws` CLI, which required a full apt-installed Python runtime for what's really
// just two GetParameter calls.

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const prefix = process.env.SSM_PARAM_PREFIX;
if (!prefix) {
  // entrypoint.sh only invokes this script when SSM_PARAM_PREFIX is set, but exit
  // cleanly (no output) if it's ever called without one.
  process.exit(0);
}

const client = new SSMClient({ region: process.env.AWS_REGION });

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function fetchParam(name) {
  const command = new GetParameterCommand({
    Name: `${prefix}/${name}`,
    WithDecryption: true,
  });
  const { Parameter } = await client.send(command);
  return Parameter.Value;
}

async function main() {
  const [databaseUrl, sessionSecret] = await Promise.all([
    fetchParam('database-url'),
    fetchParam('session-secret'),
  ]);
  process.stdout.write(`export DATABASE_URL=${shellQuote(databaseUrl)}\n`);
  process.stdout.write(`export SESSION_SECRET=${shellQuote(sessionSecret)}\n`);
}

main().catch((err) => {
  console.error('resolve-secrets: failed to fetch secrets from SSM:', err);
  process.exit(1);
});
