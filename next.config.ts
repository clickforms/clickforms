import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output produces a minimal `.next/standalone` server bundle
  // with only the production dependencies it actually needs — this is what
  // the multi-stage Dockerfile copies into the runtime image, so the final
  // image doesn't need a full `yarn install` or the whole node_modules tree.
  output: 'standalone',

  // puppeteer bundles Chromium for HTML-to-PDF submission exports.
  serverExternalPackages: ['puppeteer'],

  // Next.js 16 removed its built-in ESLint integration entirely (the `eslint`
  // config key no longer exists on `NextConfig`), so there's nothing to
  // disable here. Biome (see biome.json) is this project's only linter/formatter.
};

export default nextConfig;
