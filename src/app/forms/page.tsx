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
  const { forms, responseCounts, user } = await withOrgContext(
    session.user.organizationId,
    async (tx) => {
      const forms = await tx.form.findMany({
        where: formsListWhere(session.user.organizationId, session.user.role, session.user.id),
        orderBy: { updatedAt: 'desc' },
        include: {
          versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { id: true } },
        },
      });
      const responseCounts = await tx.submission.groupBy({
        by: ['formId'],
        where: { organizationId: session.user.organizationId, status: 'submitted' },
        _count: { _all: true },
      });
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      });
      return { forms, responseCounts, user };
    },
  );

  const responseCountByFormId = new Map(responseCounts.map((row) => [row.formId, row._count._all]));
  const totalResponses = responseCounts.reduce((sum, row) => sum + row._count._all, 0);

  const formRows = forms.map((form) => {
    const latestVersionId = form.versions[0]?.id ?? null;
    const isLive = form.currentVersionId != null;
    const hasPendingChanges =
      isLive && latestVersionId != null && latestVersionId !== form.currentVersionId;
    return {
      id: form.id,
      name: form.name,
      status: form.status,
      updatedAt: form.updatedAt.toISOString(),
      responseCount: responseCountByFormId.get(form.id) ?? 0,
      isLive,
      hasPendingChanges,
    };
  });

  const liveForms = formRows.filter((form) => form.isLive).length;
  const draftForms = formRows.filter((form) => !form.isLive && form.status !== 'archived').length;

  const displayName =
    user?.name?.trim() ||
    user?.email?.split('@')[0] ||
    session.user.email?.split('@')[0] ||
    'there';

  return (
    <DashboardClient
      displayName={displayName}
      stats={{
        liveForms,
        draftForms,
        totalResponses,
        formCount: formRows.length,
      }}
      recentForms={formRows.slice(0, 6)}
      canEdit={canCreateForms(session.user.role)}
    />
  );
}
