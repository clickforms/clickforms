#!/usr/bin/env node
'use strict';

// Fetches runtime secrets from SSM Parameter Store and prints `export KEY='value'`
// lines for entrypoint.sh to `eval`. Uses @aws-sdk/client-ssm (installed into its own
// node_modules by the Dockerfile's ssm-deps stage — see the comment there) instead of
// the `aws` CLI, which required a full apt-installed Python runtime for what's really
// just two GetParameter calls.

//
// Source selection: when INFISICAL_CLIENT_ID is set the secrets come from Infisical (see
// main() below); otherwise they come from SSM exactly as before. The two are never mixed —
// if Infisical is configured and unreachable the container fails to start rather than
// quietly booting on stale SSM values.

const infisicalConfigured = Boolean(process.env.INFISICAL_CLIENT_ID);
const prefix = process.env.SSM_PARAM_PREFIX;
if (!infisicalConfigured && !prefix) {
  // entrypoint.sh only invokes this script when one of the two is set, but exit
  // cleanly (no output) if it's ever called without either.
  process.exit(0);
}

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

let ssmClient = null;
function getSsmClient() {
  if (!ssmClient) {
    // Loaded lazily so an Infisical-only deploy never needs the AWS SDK at all.
    const { SSMClient } = require('@aws-sdk/client-ssm');
    ssmClient = new SSMClient({ region: process.env.AWS_REGION });
  }
  return ssmClient;
}

async function fetchParam(name) {
  const { GetParameterCommand } = require('@aws-sdk/client-ssm');
  const client = getSsmClient();
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

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function fetchJson(url, init, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
      if (response.ok) return await response.json();
      // 4xx (bad credentials, wrong project/environment) will not fix itself on retry.
      const body = await response.text();
      const error = new Error(`HTTP ${response.status} from ${new URL(url).pathname}: ${body.slice(0, 300)}`);
      if (response.status < 500) throw Object.assign(error, { fatal: true });
      lastError = error;
    } catch (err) {
      if (err.fatal) throw err;
      lastError = err;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }
  throw lastError;
}

/** Infisical (Universal Auth machine identity) → every secret in one project environment,
 * printed as `export KEY='value'`. Uses Node's built-in fetch against the REST API so no
 * extra dependency is added to the image. */
async function mainInfisical() {
  const required = ['INFISICAL_CLIENT_SECRET', 'INFISICAL_PROJECT_ID', 'INFISICAL_ENV'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`INFISICAL_CLIENT_ID is set but ${missing.join(', ')} is missing`);
  }
  const base = (process.env.INFISICAL_URL || 'https://app.infisical.com').replace(/\/+$/, '');

  const login = await fetchJson(`${base}/api/v1/auth/universal-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.INFISICAL_CLIENT_ID,
      clientSecret: process.env.INFISICAL_CLIENT_SECRET,
    }),
  });

  const query = new URLSearchParams({
    workspaceId: process.env.INFISICAL_PROJECT_ID,
    environment: process.env.INFISICAL_ENV,
    secretPath: '/',
    expandSecretReferences: 'true',
  });
  const { secrets } = await fetchJson(`${base}/api/v3/secrets/raw?${query}`, {
    headers: { Authorization: `Bearer ${login.accessToken}` },
  });

  if (!Array.isArray(secrets) || secrets.length === 0) {
    throw new Error(`no secrets returned for environment "${process.env.INFISICAL_ENV}"`);
  }
  const names = new Set();
  for (const { secretKey, secretValue } of secrets) {
    if (!ENV_KEY.test(secretKey)) continue;
    names.add(secretKey);
    process.stdout.write(`export ${secretKey}=${shellQuote(secretValue)}\n`);
  }
  for (const required of ['DATABASE_URL', 'SESSION_SECRET']) {
    if (!names.has(required)) throw new Error(`${required} is missing from Infisical`);
  }
  // Names only, never values.
  console.error(`resolve-secrets: loaded ${names.size} secrets from Infisical (${process.env.INFISICAL_ENV})`);
}

async function main() {
  if (infisicalConfigured) return mainInfisical();
  const [databaseUrl, sessionSecret, resendApiKey, messagemediaApiKey, messagemediaApiSecret] =
    await Promise.all([
      fetchParam('database-url'),
      fetchParam('session-secret'),
      fetchOptionalParam('resend-api-key'),
      fetchOptionalParam('messagemedia-api-key'),
      fetchOptionalParam('messagemedia-api-secret'),
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
  // Same optional treatment as resend-api-key above — src/lib/sms.ts already falls back
  // to console-logging when these are unset, and both must be present together (it's one
  // Basic Auth credential pair) or sendSms() falls back regardless, so there's no partial
  // state to warn about beyond "SMS won't send yet".
  if (messagemediaApiKey && messagemediaApiSecret) {
    process.stdout.write(`export MESSAGEMEDIA_API_KEY=${shellQuote(messagemediaApiKey)}\n`);
    process.stdout.write(`export MESSAGEMEDIA_API_SECRET=${shellQuote(messagemediaApiSecret)}\n`);
  } else {
    console.error(
      'resolve-secrets: no messagemedia-api-key/secret in SSM — SMS sends will be logged to stdout instead of sent (see DEPLOYMENT.md "SMS (MessageMedia) setup")',
    );
  }
}

main().catch((err) => {
  console.error(
    `resolve-secrets: failed to fetch secrets from ${infisicalConfigured ? 'Infisical' : 'SSM'}:`,
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
