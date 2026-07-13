import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { UserDetailsClient } from '@/app/forms/settings/user-details/user-details-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';

export default async function UserDetailsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  const user = await withOrgContext(session.user.organizationId, (tx) =>
    tx.user.findFirstOrThrow({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, phone: true },
    }),
  );

  return <UserDetailsClient initialProfile={user} />;
}
