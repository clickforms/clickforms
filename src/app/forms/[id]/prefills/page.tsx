import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { PrefillsListClient } from '@/app/forms/[id]/prefills/prefills-list-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { listPrefills, prefillStatus } from '@/lib/forms/prefills';
import { formatResponseLabel, listResponseLabelCandidates } from '@/lib/forms/response-label';
import { formSchemaSchema } from '@/lib/forms/schema';
import { prefillUrl } from '@/lib/forms/send-prefill-email';
import { requireOrganizationId } from '@/lib/session';
import { canEditForm } from '@/lib/user-roles';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrefillsPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return null;

  const result = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id, organizationId: requireOrganizationId(session) },
    });
    if (!form) return null;
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: requireOrganizationId(session) },
      select: { subdomain: true },
    });
    const holdRows = await tx.$queryRaw<{ hold: boolean }[]>`
      SELECT hold_prefilled_responses AS hold FROM forms WHERE id = ${form.id}::uuid`;
    const labelRows = await tx.$queryRaw<{ response_label_field_id: string | null }[]>`
      SELECT response_label_field_id FROM forms WHERE id = ${form.id}::uuid`;
    const labelFieldId = labelRows[0]?.response_label_field_id ?? null;
    const version = form.currentVersionId
      ? await tx.formVersion.findFirst({ where: { id: form.currentVersionId } })
      : null;
    return {
      form,
      labelFieldId,
      schema: version?.schema ?? null,
      rows: await listPrefills(tx, form.id, labelFieldId),
      subdomain: organization.subdomain,
      hold: holdRows[0]?.hold ?? true,
    };
  });
  if (!result) notFound();

  const { form, rows, subdomain, hold, labelFieldId } = result;
  const parsedSchema = formSchemaSchema.safeParse(result.schema);
  const schema = parsedSchema.success ? parsedSchema.data : undefined;
  const columnFields = schema ? listResponseLabelCandidates(schema) : [];
  const columnLabel =
    (labelFieldId ? schema?.fields[labelFieldId]?.label : null) ||
    (labelFieldId ? 'Prefill' : 'Recipient');
  const canCustomize = canEditForm(session.user.role, form.createdBy, session.user.id);
  return (
    <div className="submissions-page">
      <div className="submissions-page-header">
        <p className="submissions-page-kicker">{form.name}</p>
        <h1 className="submissions-page-title">Prefills</h1>
        <p className="submissions-page-subtitle">
          Forms you&apos;ve sent with answers already filled in. Responses that come back appear
          under Responses, marked as prefilled.
        </p>
      </div>
      <PrefillsListClient
        formId={form.id}
        slug={form.slug}
        isLive={Boolean(form.currentVersionId)}
        holdResponses={hold}
        columnLabel={columnLabel}
        columnFields={columnFields}
        columnFieldId={labelFieldId}
        canCustomize={canCustomize}
        initialPrefills={rows.map((row) => ({
          id: row.id,
          recipientEmail: row.recipient_email,
          recipientName: row.recipient_name,
          label: labelFieldId ? formatResponseLabel(schema, labelFieldId, row.label_value) : null,
          url: prefillUrl(subdomain, form.slug, row.token),
          continueHref: `/f/${form.slug}/prefill?draft=${row.id}`,
          detailHref: `/forms/${form.id}/prefills/${row.id}`,
          sendAgainHref: `/f/${form.slug}/prefill?from=${row.id}`,
          status: prefillStatus(row),
          sentAt: (row.sent_at ?? row.created_at).toISOString(),
          createdBy: row.created_by_name,
          responses: row.completed,
        }))}
      />
    </div>
  );
}
