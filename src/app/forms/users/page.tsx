import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { type PendingInviteRow, type UserRow, UsersClient } from '@/app/forms/users/users-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { canManageUsers } from '@/lib/user-roles';

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  if (!canManageUsers(session.user.role)) {
    redirect('/forms');
  }

  const { users, pendingInvites } = await withOrgContext(
    session.user.organizationId,
    async (tx) => {
      const [userRows, inviteRows, formCounts] = await Promise.all([
        tx.user.findMany({
          where: { organizationId: session.user.organizationId },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        }),
        tx.userInvite.findMany({
          where: {
            organizationId: session.user.organizationId,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            expiresAt: true,
            createdAt: true,
          },
        }),
        tx.form.groupBy({
          by: ['createdBy'],
          where: { organizationId: session.user.organizationId },
          _count: { _all: true },
        }),
      ]);

      const formsOwnedByUserId = new Map(formCounts.map((row) => [row.createdBy, row._count._all]));

      return {
        users: userRows.map(
          (user): UserRow => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
            formsOwned: formsOwnedByUserId.get(user.id) ?? 0,
            assignedForms: 0,
          }),
        ),
        pendingInvites: inviteRows.map(
          (invite): PendingInviteRow => ({
            id: invite.id,
            email: invite.email,
            name: invite.name,
            role: invite.role,
            createdAt: invite.createdAt.toISOString(),
            expiresAt: invite.expiresAt.toISOString(),
          }),
        ),
      };
    },
  );

  return (
    <UsersClient
      currentUserId={session.user.id}
      initialUsers={users}
      initialPendingInvites={pendingInvites}
    />
  );
}
