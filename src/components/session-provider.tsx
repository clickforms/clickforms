'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

/**
 * Thin wrapper so call sites don't import directly from `next-auth/react`. Scoped
 * locally around just the two platform-admin org-switching features that need
 * `useSession().update()` (src/app/admin/organisations/[id]/join-organisation-button.tsx
 * and src/app/forms/temporary-org-banner.tsx) rather than wrapped around the whole app —
 * nothing else in Clickforms uses the `useSession` hook (everywhere else calls
 * `signIn`/`signOut` directly, which don't need this context), so there's no reason to
 * pay for a global session fetch on every page.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
