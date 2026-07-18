import { getServerSession } from 'next-auth';
import { FormsListClient } from '@/app/forms/forms-list-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { buildOrgFormUrl } from '@/lib/tenant';
import { canCreateForms, formsListWhere } from '@/lib/user-roles';

export default async function FormsListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  // These run sequentially (not Promise.all) because they share a single connection via
  // withOrgContext's transaction — issuing concurrent queries on one `pg` client triggers
  // a deprecation warning (and will error outright in pg@9.0).
  const { forms, responseCounts, organization, orgMembers } = await withOrgContext(
    session.user.organizationId,
    async (tx) => {
      const forms = await tx.form.findMany({
        where: formsListWhere(session.user.organizationId, session.user.role, session.user.id),
        orderBy: { updatedAt: 'desc' },
        include: { creator: { select: { name: true, email: true } } },
      });
      const responseCounts = await tx.submission.groupBy({
        by: ['formId'],
        where: { organizationId: session.user.organizationId, status: 'submitted' },
        _count: { _all: true },
      });
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: session.user.organizationId },
        select: { subdomain: true },
      });
      const orgMembers = await tx.user.findMany({
        where: { organizationId: session.user.organizationId },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      });
      return { forms, responseCounts, organization, orgMembers };
    },
  );

  const responseCountByFormId = new Map(responseCounts.map((row) => [row.formId, row._count._all]));

  // Public form pages live on the org's subdomain (not this admin dashboard's domain —
  // see src/middleware.ts), so "View form" needs an absolute URL rather than a
  // same-origin relative /f/[slug] link.
  const formSummaries = forms.map((form) => ({
    id: form.id,
    name: form.name,
    slug: form.slug,
    status: form.status,
    updatedAt: form.updatedAt.toISOString(),
    createdAt: form.createdAt.toISOString(),
    responseCount: responseCountByFormId.get(form.id) ?? 0,
    publicUrl: buildOrgFormUrl(organization.subdomain, `/f/${form.slug}`),
    createdById: form.createdBy,
    createdByName: form.creator.name ?? form.creator.email,
    isOwnForm: form.createdBy === session.user.id,
    isPrivate: form.isPrivate,
  }));

  const memberSummaries = orgMembers.map((member) => ({
    id: member.id,
    name: member.name ?? member.email,
  }));

  return (
    <FormsListClient
      initialForms={formSummaries}
      canEdit={canCreateForms(session.user.role)}
      currentUserDisplayName={session.user.email ?? 'You'}
      orgMembers={memberSummaries}
    />
  );
}
