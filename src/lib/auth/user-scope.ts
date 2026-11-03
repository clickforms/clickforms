import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma, withOrgContext } from '@/lib/db';

/** Runs `fn` with a client that can see the signed-in user's own row: an org-scoped RLS
 * transaction for organisation members, the plain client for platform-only admins (who have
 * no organisation) — the same split src/app/api/me/password/route.ts uses. */
export async function withUserScope<T>(
  organizationId: string | null | undefined,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (organizationId) return withOrgContext(organizationId, fn);
  return prisma.$transaction(fn);
}
