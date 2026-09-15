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

/** Unlike database-url/session-secret, resend-api-key is optional — src/lib/email.ts
 * already falls back to console-logging instead of sending when RESEND_API_KEY is unset,
 * so a not-yet-provisioned parameter (DEPLOYMENT.md §4's Resend setup is a separate,
 * later step from initial infra provisioning) shouldn't crash the container's startup. */
async function fetchOptionalParam(name) {
  try {
    return await fetchParam(name);
  } catch (err) {
    if (err.name === 'ParameterNotFound') return null;
    throw err;
  }
}

async function main() {
  const [databaseUrl, sessionSecret, resendApiKey] = await Promise.all([
    fetchParam('database-url'),
    fetchParam('session-secret'),
    fetchOptionalParam('resend-api-key'),
  ]);
  process.stdout.write(`export DATABASE_URL=${shellQuote(databaseUrl)}\n`);
  process.stdout.write(`export SESSION_SECRET=${shellQuote(sessionSecret)}\n`);
  if (resendApiKey) {
    process.stdout.write(`export RESEND_API_KEY=${shellQuote(resendApiKey)}\n`);
  } else {
    console.error(
      'resolve-secrets: no resend-api-key in SSM — emails will be logged to stdout instead of sent (see DEPLOYMENT.md §4)',
    );
  }
}

main().catch((err) => {
  console.error('resolve-secrets: failed to fetch secrets from SSM:', err);
  process.exit(1);
});
