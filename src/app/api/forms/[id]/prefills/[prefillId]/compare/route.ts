import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { buildPrefillComparison } from '@/lib/forms/prefill-compare';
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
      const prefills = await tx.$queryRaw<{ answers: Record<string, unknown> }[]>`
        SELECT answers FROM form_prefills
        WHERE id = ${prefillId}::uuid AND form_id = ${form.id}::uuid`;
      const prefill = prefills[0];
      if (!prefill) return null;

      const responses = await tx.$queryRaw<ResponseRow[]>`
        SELECT id, answers, status::text AS status, prefill_held, submitted_at, form_version_id
        FROM submissions
        WHERE prefill_id = ${prefillId}::uuid AND (prefill_held OR status <> 'in_progress')
        ORDER BY created_at DESC LIMIT 1`;
      const response = responses[0] ?? null;

      const versionId = response?.form_version_id ?? form.currentVersionId;
      const version = versionId
        ? await tx.formVersion.findFirst({ where: { id: versionId } })
        : null;
      return { prefill, response, version };
    });
    if (!data) throw new NotFoundError('Prefill');

    const parsed = data.version ? formSchemaSchema.safeParse(data.version.schema) : null;
    const rows = parsed?.success
      ? buildPrefillComparison(parsed.data, data.prefill.answers, data.response?.answers ?? null)
      : [];

    return NextResponse.json({
      rows,
      responseId: data.response?.id ?? null,
      held: Boolean(data.response?.prefill_held),
      returnedAt: data.response?.submitted_at?.toISOString() ?? null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
