import type { Prisma, UserRole } from '@prisma/client';
import { InvalidRequestError } from '@/lib/api-errors';

type UserCountClient = Pick<Prisma.TransactionClient, 'user'>;

export async function countOrgAdmins(tx: UserCountClient, organizationId: string): Promise<number> {
  return tx.user.count({
    where: { organizationId, role: 'admin' },
  });
}

/** Ensures removing or demoting this user won't leave the org without an admin. */
export async function assertNotLastAdmin(
  tx: UserCountClient,
  organizationId: string,
  _userId: string,
  userRole: UserRole,
  nextRole?: UserRole,
): Promise<void> {
  if (userRole !== 'admin') return;
  if (nextRole === 'admin') return;

  const adminCount = await countOrgAdmins(tx, organizationId);
  if (adminCount <= 1) {
    throw new InvalidRequestError('Your organisation must have at least one organisation admin.');
  }
}

export function assertNotSelf(actorUserId: string, targetUserId: string): void {
  if (actorUserId === targetUserId) {
    throw new InvalidRequestError('You cannot perform this action on your own account.');
  }
}
