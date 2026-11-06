#!/usr/bin/env node
'use strict';

// Fetches every secret/config value from one Infisical project environment (Universal Auth
// machine identity) and prints them as `export KEY='value'` lines. Run by start.sh inside a
// throwaway container of the app image; the output is eval'd by start.sh and handed to
// `docker compose`. Uses Node's built-in fetch against the REST API: no dependencies.
// Any failure exits non-zero — there is deliberately no fallback source.

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
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
      const error = new Error(
        `HTTP ${response.status} from ${new URL(url).pathname}: ${body.slice(0, 300)}`,
      );
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
async function main() {
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
  console.error(
    `resolve-secrets: loaded ${names.size} secrets from Infisical (${process.env.INFISICAL_ENV})`,
  );
}

main().catch((err) => {
  console.error(
    'resolve-secrets: failed to fetch secrets from Infisical:',
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
