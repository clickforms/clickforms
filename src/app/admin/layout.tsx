import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { ReactNode } from 'react';
import { AdminPlatformShell } from '@/app/admin/admin-platform-shell';
import { authOptions } from '@/lib/auth';
import { prisma, withOrgContext } from '@/lib/db';

/**
 * Gate for the entire /admin subtree (Clickforms platform-staff area — organisation
 * onboarding, invites, cross-org management). Separate from src/app/forms/layout.tsx
 * because this area isn't scoped to the signed-in user's own organization at all; it
 * deliberately reads via the plain `prisma` client, same reasoning as the admin API
 * routes under src/app/api/admin.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/admin')}`);
  }
  if (!session.user.isPlatformAdmin) {
    redirect('/forms');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  // Only fetched so the account menu's "Log in to <org>" link (see AccountMenu) can name
  // the organisation instead of speaking generically.
  const currentOrganizationId = session.user.organizationId;
  const organization = currentOrganizationId
    ? await withOrgContext(currentOrganizationId, (tx) =>
        tx.organization.findUnique({
          where: { id: currentOrganizationId },
          select: { name: true },
        }),
      )
    : null;

  return (
    <AdminPlatformShell
      email={session.user.email ?? 'Signed in'}
      name={user?.name ?? null}
      belongsToOrganization={session.user.organizationId !== null}
      organizationName={organization?.name ?? null}
    >
      {children}
    </AdminPlatformShell>
  );
}
