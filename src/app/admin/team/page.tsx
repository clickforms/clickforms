import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import {
  type PendingTeamInvite,
  type PlatformAdminRow,
  TeamAdminClient,
} from '@/app/admin/team/team-admin-client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function AdminTeamPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  const [admins, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { isPlatformAdmin: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, platformAdminRole: true, createdAt: true },
    }),
    prisma.platformAdminInvite.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, expiresAt: true, createdAt: true },
    }),
  ]);

  const initialAdmins: PlatformAdminRow[] = admins.map((admin) => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    // Backfilled to super_admin for pre-existing platform admins (see migration
    // 20260910000100) — null here would only mean a data inconsistency.
    role: admin.platformAdminRole ?? 'super_admin',
    createdAt: admin.createdAt.toISOString(),
    isSelf: admin.id === session.user.id,
  }));

  const initialPendingInvites: PendingTeamInvite[] = pendingInvites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
  }));

  return (
    <TeamAdminClient initialAdmins={initialAdmins} initialPendingInvites={initialPendingInvites} />
  );
}
