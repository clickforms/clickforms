import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { PrefillDetailClient } from '@/app/forms/[id]/prefills/[prefillId]/prefill-detail-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { buildPrefillComparison } from '@/lib/forms/prefill-compare';
import { prefillStatus } from '@/lib/forms/prefills';
import { formSchemaSchema } from '@/lib/forms/schema';
import { prefillUrl } from '@/lib/forms/send-prefill-email';
import { requireOrganizationId } from '@/lib/session';

interface PageProps {
  params: Promise<{ id: string; prefillId: string }>;
}

interface DetailRow {
  id: string;
  is_draft: boolean;
  recipient_email: string | null;
  recipient_name: string | null;
  token: string;
  answers: Record<string, unknown>;
  sent_at: Date | null;
  opened_at: Date | null;
  expires_at: Date;
  created_at: Date;
  created_by_name: string | null;
}

interface ResponseRow {
  id: string;
  answers: Record<string, unknown>;
  status: string;
  prefill_held: boolean;
  submitted_at: Date | null;
  form_version_id: string;
}

export default async function PrefillDetailPage({ params }: PageProps) {
  const { id, prefillId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return null;
  if (!/^[0-9a-f-]{36}$/i.test(prefillId)) notFound();

  const result = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id, organizationId: requireOrganizationId(session) },
    });
    if (!form) return null;
    const prefills = await tx.$queryRaw<DetailRow[]>`
      SELECT p.id, p.is_draft, p.recipient_email, p.recipient_name, p.token, p.answers, p.sent_at,
             p.opened_at, p.expires_at, p.created_at, COALESCE(u.name, u.email) AS created_by_name
      FROM form_prefills p LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ${prefillId}::uuid AND p.form_id = ${form.id}::uuid`;
    const prefill = prefills[0];
    if (!prefill) return null;

    // The response that came back (a finished one wins over an abandoned in-progress one).
    const responses = await tx.$queryRaw<ResponseRow[]>`
      SELECT id, answers, status::text AS status, prefill_held, submitted_at, form_version_id
      FROM submissions
      WHERE prefill_id = ${prefillId}::uuid
      ORDER BY (prefill_held OR status <> 'in_progress') DESC, created_at DESC
      LIMIT 1`;
    const response = responses[0] ?? null;

    const versionId = response?.form_version_id ?? form.currentVersionId;
    const version = versionId ? await tx.formVersion.findFirst({ where: { id: versionId } }) : null;
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: requireOrganizationId(session) },
      select: { subdomain: true },
    });
    const counts = await tx.$queryRaw<{ responses: number; completed: number; held: number }[]>`
      SELECT
        (SELECT count(*)::int FROM submissions s WHERE s.prefill_id = ${prefillId}::uuid AND NOT s.prefill_held) AS responses,
        (SELECT count(*)::int FROM submissions s WHERE s.prefill_id = ${prefillId}::uuid AND s.status <> 'in_progress') AS completed,
        (SELECT count(*)::int FROM submissions s WHERE s.prefill_id = ${prefillId}::uuid AND s.prefill_held) AS held`;
    return {
      form,
      prefill,
      response,
      version,
      subdomain: organization.subdomain,
      counts: counts[0],
    };
  });
  if (!result) notFound();

  const { form, prefill, response, version, subdomain, counts } = result;
  const parsedSchema = version ? formSchemaSchema.safeParse(version.schema) : null;
  const status = prefillStatus({
    is_draft: prefill.is_draft,
    opened_at: prefill.opened_at,
    expires_at: prefill.expires_at,
    responses: counts?.responses ?? 0,
    completed: counts?.completed ?? 0,
    held: counts?.held ?? 0,
  });
  const rows = parsedSchema?.success
    ? buildPrefillComparison(
        parsedSchema.data,
        prefill.answers,
        response && (response.prefill_held || response.status !== 'in_progress')
          ? response.answers
          : null,
      )
    : [];

  return (
    <div className="pfd-page">
      <Link href={`/forms/${form.id}/prefills`} className="pfd-back">
        ← Prefills
      </Link>
      <PrefillDetailClient
        formId={form.id}
        slug={form.slug}
        prefillId={prefill.id}
        status={status}
        recipientName={prefill.recipient_name}
        recipientEmail={prefill.recipient_email}
        url={prefillUrl(subdomain, form.slug, prefill.token)}
        sentAt={(prefill.sent_at ?? prefill.created_at).toISOString()}
        openedAt={prefill.opened_at ? prefill.opened_at.toISOString() : null}
        createdBy={prefill.created_by_name}
        returnedAt={response?.submitted_at ? response.submitted_at.toISOString() : null}
        responseId={
          response && (response.prefill_held || response.status !== 'in_progress')
            ? response.id
            : null
        }
        held={Boolean(response?.prefill_held)}
        rows={rows}
      />
    </div>
  );
}
