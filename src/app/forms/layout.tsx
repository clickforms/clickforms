import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { ReactNode } from 'react';
import { AdminShellClient } from '@/app/forms/admin-shell-client';
import { authOptions } from '@/lib/auth';

export default async function FormsLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/forms')}`);
  }

  const email = session.user.email ?? 'Signed in';

  return (
    <AdminShellClient email={email} userRole={session.user.role}>
      {children}
    </AdminShellClient>
  );
}
