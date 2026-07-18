import { getServerSession } from 'next-auth';
import { DashboardClient } from '@/app/forms/dashboard-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { canCreateForms, formsListWhere } from '@/lib/user-roles';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  // Sequential, not Promise.all — both queries share one connection via withOrgContext's
  // transaction, and concurrent queries on a single `pg` client are deprecated (and will
  // error in pg@9.0).
  const { forms, responseCounts } = await withOrgContext(
    session.user.organizationId,
    async (tx) => {
      const forms = await tx.form.findMany({
        where: formsListWhere(session.user.organizationId, session.user.role, session.user.id),
        orderBy: { updatedAt: 'desc' },
      });
      const responseCounts = await tx.submission.groupBy({
        by: ['formId'],
        where: { organizationId: session.user.organizationId, status: 'submitted' },
        _count: { _all: true },
      });
      return { forms, responseCounts };
    },
  );

  const totalResponses = responseCounts.reduce((sum, row) => sum + row._count._all, 0);

  const stats = {
    activeForms: forms.filter((form) => form.status === 'published').length,
    totalResponses,
  };

  return (
    <DashboardClient
      stats={stats}
      formCount={forms.length}
      canEdit={canCreateForms(session.user.role)}
    />
  );
}
