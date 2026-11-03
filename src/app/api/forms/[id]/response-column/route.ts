import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { listResponseLabelCandidates } from '@/lib/forms/response-label';
import { createEmptyFormSchema, formSchemaSchema } from '@/lib/forms/schema';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ fieldId: z.string().min(1).nullable() });

/** Sets which field is shown in the first column of the Responses list (null = automatic). */
export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;
    const { fieldId } = bodySchema.parse(await request.json());
    const organizationId = requireOrganizationId(session);

    await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({ where: { id, organizationId } });
      assertFormEditAccess(form, session.user.role, session.user.id);

      if (fieldId !== null) {
        const latest = await tx.formVersion.findFirst({
          where: { formId: form.id },
          orderBy: { versionNumber: 'desc' },
        });
        const parsed = latest ? formSchemaSchema.safeParse(latest.schema) : null;
        const schema = parsed?.success ? parsed.data : createEmptyFormSchema();
        if (!listResponseLabelCandidates(schema).some((c) => c.id === fieldId)) {
          throw new InvalidRequestError('That field can’t be shown in the Responses list.');
        }
      }
      await tx.$executeRaw`
        UPDATE forms SET response_label_field_id = ${fieldId} WHERE id = ${form.id}::uuid`;
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
