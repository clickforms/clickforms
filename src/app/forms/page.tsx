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

  const [forms, responseCounts] = await withOrgContext(session.user.organizationId, (tx) =>
    Promise.all([
      tx.form.findMany({
        where: formsListWhere(session.user.organizationId, session.user.role, session.user.id),
        orderBy: { updatedAt: 'desc' },
      }),
      tx.submission.groupBy({
        by: ['formId'],
        where: { organizationId: session.user.organizationId, status: 'submitted' },
        _count: { _all: true },
      }),
    ]),
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
