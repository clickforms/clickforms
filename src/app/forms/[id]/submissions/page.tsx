import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { SubmissionsListClient } from '@/app/forms/[id]/submissions/submissions-list-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { deriveParticipantName, participantFieldIds } from '@/lib/forms/participant-name';
import { type FormSchema, formSchemaSchema } from '@/lib/forms/schema';
import { requireOrganizationId } from '@/lib/session';
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

  // See the identical comment in src/app/forms/page.tsx — FormsLayout's redirect for a
  // platform-only admin can race with this page's own render, so this page needs its own
  // quiet bail-out rather than assuming the layout always wins first.
  if (!session.user.organizationId) {
    return null;
  }

  const result = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id, organizationId: requireOrganizationId(session) },
    });
    if (!form) {
      return null;
    }

    // Excludes 'in_progress' rows: those are created the moment a respondent uploads a
    // file/signature or hits Submit, so every abandoned or still-in-progress form open
    // would otherwise show up here as a phantom response. This mirrors the responseCount
    // badge (form-workspace-context / forms/[id]/layout.tsx) and dashboard totals
    // (forms/page.tsx, forms/list/page.tsx), which already only count 'submitted'.
    const submissions = await tx.submission.findMany({
      where: {
        formId: form.id,
        organizationId: requireOrganizationId(session),
        status: { not: 'in_progress' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        ipAddress: true,
        createdAt: true,
        formVersionId: true,
      },
    });

    // The participant name needs a few answer values, but the full answers JSON (signatures,
    // tables, long text) can be large and this list loads every response — so pull only the
    // handful of name/email keys out in SQL rather than selecting the whole blob.
    const versions = await tx.formVersion.findMany({
      where: { formId: form.id, organizationId: requireOrganizationId(session) },
      select: { id: true, schema: true },
    });
    const candidateKeys = new Set<string>();
    for (const version of versions) {
      const parsed = formSchemaSchema.safeParse(version.schema);
      if (parsed.success) {
        for (const key of participantFieldIds(parsed.data)) candidateKeys.add(key);
      }
    }
    const picked =
      candidateKeys.size === 0
        ? []
        : await tx.$queryRaw<{ id: string; picked: Record<string, unknown> | null }[]>`
            SELECT s.id,
              (SELECT jsonb_object_agg(k, s.answers -> k)
                 FROM unnest(${[...candidateKeys]}::text[]) AS k
                WHERE jsonb_exists(s.answers, k)) AS picked
            FROM submissions s
            WHERE s.form_id = ${form.id}::uuid AND s.status <> 'in_progress'`;
    const pickedAnswersById = new Map(picked.map((row) => [row.id, row.picked ?? {}]));

    return { form, submissions, versions, pickedAnswersById };
  });

  if (!result) {
    notFound();
  }

  const { form, submissions, versions, pickedAnswersById } = result;
  const canDelete = canEditForm(session.user.role, form.createdBy, session.user.id);

  const schemaByVersionId = new Map<string, FormSchema>();
  for (const version of versions) {
    const parsed = formSchemaSchema.safeParse(version.schema);
    if (parsed.success) {
      schemaByVersionId.set(version.id, parsed.data);
    }
  }

  return (
    <div className="submissions-page">
      <div className="submissions-page-header">
        <p className="submissions-page-kicker">{form.name}</p>
        <h1 className="submissions-page-title">Responses</h1>
        <p className="submissions-page-subtitle">
          Every response submitted through this form, newest first.
        </p>
      </div>

      <SubmissionsListClient
        formId={form.id}
        canDelete={canDelete}
        initialSubmissions={submissions.map((submission) => ({
          id: submission.id,
          status: submission.status,
          submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
          ipAddress: submission.ipAddress,
          participantName: (() => {
            const schema = schemaByVersionId.get(submission.formVersionId);
            return schema
              ? deriveParticipantName(schema, pickedAnswersById.get(submission.id) ?? {})
              : null;
          })(),
          createdAt: submission.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
