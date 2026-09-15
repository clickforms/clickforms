import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { type PlatformUserRow, UsersAdminClient } from '@/app/admin/users/users-admin-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Cross-organisation user directory for platform admins — separate from any single
 * org's /forms/settings/users, which only sees its own tenant. Reads via the plain
 * `prisma` client for the same reason as the rest of /admin (see
 * src/app/api/admin/organizations/route.ts's doc comment): RLS can only scope to one
 * organisation at a time, and this page's whole point is to see across all of them.
 */
export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const users = await prisma.user.findMany({
    // Field-level `{ not: null }` trips a validation bug on this Prisma version
    // ("Argument `not` must not be null") — the equivalent top-level `NOT` works fine.
    where: { NOT: { organizationId: null } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      twoFactorEnabled: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  });

  const initialUsers: PlatformUserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toISOString(),
    organizationId: user.organization?.id ?? null,
    organizationName: user.organization?.name ?? '—',
  }));

  return <UsersAdminClient initialUsers={initialUsers} />;
}
