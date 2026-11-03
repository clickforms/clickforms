import { getServerSession } from 'next-auth';
import { TwoFactorClient } from '@/app/forms/settings/two-factor/two-factor-client';
import { authOptions } from '@/lib/auth';
import { withUserScope } from '@/lib/auth/user-scope';

export default async function TwoFactorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const user = await withUserScope(session.user.organizationId, (tx) =>
    tx.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true, email: true },
    }),
  );

  return (
    <TwoFactorClient initialEnabled={user?.twoFactorEnabled ?? false} email={user?.email ?? ''} />
  );
}
