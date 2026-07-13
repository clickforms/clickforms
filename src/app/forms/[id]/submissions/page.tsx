import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { SubmissionsListClient } from '@/app/forms/[id]/submissions/submissions-list-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { canEditForm } from '@/lib/user-roles';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SubmissionsListPage({ params }: PageProps) {
  const { id } = await params;

  // FormsLayout already redirects unauthenticated requests — this session read can't be
  // null in practice, but requireSession()'s throw-based flow is for API routes, not
  // Server Components (mirrors src/app/forms/[id]/builder/page.tsx).
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const result = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!form) {
      return null;
    }

    // No `answers` in the select — this is a list view, the full JSONB answer blob is
    // only needed on the detail page.
    //
    // Excludes 'in_progress' rows: those are created the moment a respondent uploads a
    // file/signature or hits Submit, so every abandoned or still-in-progress form open
    // would otherwise show up here as a phantom response. This mirrors the responseCount
    // badge (form-workspace-context / forms/[id]/layout.tsx) and dashboard totals
    // (forms/page.tsx, forms/list/page.tsx), which already only count 'submitted'.
    const submissions = await tx.submission.findMany({
      where: {
        formId: form.id,
        organizationId: session.user.organizationId,
        status: { not: 'in_progress' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    return { form, submissions };
  });

  if (!result) {
    notFound();
  }

  const { form, submissions } = result;
  const canDelete = canEditForm(session.user.role, form.createdBy, session.user.id);

  return (
    <div>
      <h1>Responses</h1>

      <SubmissionsListClient
        formId={form.id}
        canDelete={canDelete}
        initialSubmissions={submissions.map((submission) => ({
          id: submission.id,
          status: submission.status,
          submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
          ipAddress: submission.ipAddress,
          createdAt: submission.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
