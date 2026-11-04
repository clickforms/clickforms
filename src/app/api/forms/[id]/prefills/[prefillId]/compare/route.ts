import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { buildPrefillComparison } from '@/lib/forms/prefill-compare';
import { configuredResponseLabel } from '@/lib/forms/response-label';
import { formSchemaSchema } from '@/lib/forms/schema';
import { requireOrganizationId, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; prefillId: string }>;
}

interface ResponseRow {
  id: string;
  answers: Record<string, unknown>;
  status: string;
  prefill_held: boolean;
  submitted_at: Date | null;
  form_version_id: string;
  sent_back_at: Date | null;
  prefill_id: string;
  round: number;
  original: Record<string, unknown>;
}

/** What was sent vs what came back for one prefill — loaded when its row is expanded. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { id, prefillId } = await params;
    const organizationId = requireOrganizationId(session);

    const data = await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({ where: { id, organizationId } });
      if (!form) return null;
      const prefills = await tx.$queryRaw<
        {
          answers: Record<string, unknown>;
          recipient_name: string | null;
          recipient_email: string | null;
        }[]
      >`
        SELECT answers, recipient_name, recipient_email FROM form_prefills
        WHERE id = ${prefillId}::uuid AND form_id = ${form.id}::uuid`;
      const prefill = prefills[0];
      if (!prefill) return null;

      // The prefill plus any corrections sent back under it, oldest round first.
      const responses = await tx.$queryRaw<ResponseRow[]>`
        SELECT s.id, s.answers, s.status::text AS status, s.prefill_held, s.submitted_at,
               s.form_version_id, s.sent_back_at, s.prefill_id, f.answers AS original,
               (CASE WHEN f.parent_id IS NULL THEN 0
                     ELSE (SELECT count(*)::int FROM form_prefills x
                           WHERE x.parent_id = f.parent_id AND x.created_at <= f.created_at) END) AS round
        FROM submissions s JOIN form_prefills f ON f.id = s.prefill_id
        WHERE (f.id = ${prefillId}::uuid OR f.parent_id = ${prefillId}::uuid)
          AND (s.prefill_held OR s.status <> 'in_progress')
        ORDER BY s.created_at DESC`;
      const response = responses[0] ?? null;

      const versionId = response?.form_version_id ?? form.currentVersionId;
      const version = versionId
        ? await tx.formVersion.findFirst({ where: { id: versionId } })
        : null;
      const labelRows = await tx.$queryRaw<{ response_label_field_id: string | null }[]>`
        SELECT response_label_field_id FROM forms WHERE id = ${form.id}::uuid`;
      return {
        prefill,
        response,
        responses,
        version,
        labelFieldId: labelRows[0]?.response_label_field_id ?? null,
      };
    });
    if (!data) throw new NotFoundError('Prefill');

    const parsed = data.version ? formSchemaSchema.safeParse(data.version.schema) : null;
    const rows = parsed?.success
      ? buildPrefillComparison(
          parsed.data,
          data.response?.original ?? data.prefill.answers,
          data.response?.answers ?? null,
        )
      : [];

    // Each returned response, newest first — it opens on the review page. `changed` counts the
    // fields that differ from what was sent to that person in that round.
    const countChanged = (original: Record<string, unknown>, returned: Record<string, unknown>) =>
      parsed?.success
        ? buildPrefillComparison(parsed.data, original, returned).filter((r) =>
            ['changed', 'added', 'cleared'].includes(r.status),
          ).length
        : 0;
    const list = data.responses.map((row) => ({
      id: row.id,
      held: row.prefill_held && !row.sent_back_at,
      sentBack: Boolean(row.sent_back_at),
      round: row.round,
      changed: countChanged(row.original, row.answers),
      submittedAt: row.submitted_at?.toISOString() ?? null,
      // The form's chosen identifying field, else who the prefill was sent to — never a guess
      // from field names, which can land on a staff member instead of the client.
      label:
        (parsed?.success
          ? configuredResponseLabel(parsed.data, data.labelFieldId, row.answers)
          : null) ??
        (data.prefill.recipient_name || data.prefill.recipient_email || null),
    }));
    const changedCount = list[0]?.changed ?? 0;

    return NextResponse.json({
      responses: list,
      changedCount,
      rows,
      responseId: data.response?.id ?? null,
      held: Boolean(data.response?.prefill_held),
      returnedAt: data.response?.submitted_at?.toISOString() ?? null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
