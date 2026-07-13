import { getServerSession } from 'next-auth';
import { FormsListClient } from '@/app/forms/forms-list-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { canCreateForms, formsListWhere } from '@/lib/user-roles';

export default async function FormsListPage() {
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

  const responseCountByFormId = new Map(responseCounts.map((row) => [row.formId, row._count._all]));

  const formSummaries = forms.map((form) => ({
    id: form.id,
    name: form.name,
    slug: form.slug,
    status: form.status,
    updatedAt: form.updatedAt.toISOString(),
    createdAt: form.createdAt.toISOString(),
    responseCount: responseCountByFormId.get(form.id) ?? 0,
  }));

  return (
    <FormsListClient initialForms={formSummaries} canEdit={canCreateForms(session.user.role)} />
  );
}
