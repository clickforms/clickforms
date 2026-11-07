import 'server-only';

import type { Prisma } from '@prisma/client';
import { type PlanUsage, startOfCurrentMonth } from '@/lib/admin/plan-limits';

/** The four usage numbers every billing surface shows (and every downgrade is checked
 * against). Call inside the organisation's withOrgContext transaction. */
export async function getOrgPlanUsage(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<PlanUsage> {
  const [forms, users, orgFiles, submissionFiles, submissionsThisMonth] = await Promise.all([
    tx.form.count({ where: { organizationId } }),
    tx.user.count({ where: { organizationId } }),
    tx.organizationFile.aggregate({ where: { organizationId }, _sum: { sizeBytes: true } }),
    tx.submissionFile.aggregate({ where: { organizationId }, _sum: { sizeBytes: true } }),
    tx.submission.count({
      where: { organizationId, submittedAt: { gte: startOfCurrentMonth() } },
    }),
  ]);
  return {
    forms,
    users,
    storageBytes: (orgFiles._sum.sizeBytes ?? 0) + (submissionFiles._sum.sizeBytes ?? 0),
    submissionsThisMonth,
  };
}
