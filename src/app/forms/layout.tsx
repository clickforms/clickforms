import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { ReactNode } from 'react';
import { AdminShellClient } from '@/app/forms/admin-shell-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';

export default async function FormsLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/forms')}`);
  }

  const email = session.user.email ?? 'Signed in';
  // The session/JWT only carries id/organizationId/role (see types/next-auth.d.ts) — the
  // display name for the account menu's avatar comes from a direct lookup, same as the
  // dashboard's greeting (src/app/forms/page.tsx).
  const user = await withOrgContext(session.user.organizationId, (tx) =>
    tx.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
  );

  return (
    <AdminShellClient email={email} name={user?.name ?? null} userRole={session.user.role}>
      {children}
    </AdminShellClient>
  );
}
