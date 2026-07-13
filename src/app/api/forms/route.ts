import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { createEmptyFormSchema } from '@/lib/forms/schema';
import { slugify, uniqueSlug } from '@/lib/forms/slug';
import {
  createSchemaFromTemplate,
  FORM_TEMPLATE_IDS,
  type FormTemplateId,
} from '@/lib/forms/templates';
import { requireRole, requireSession } from '@/lib/session';
import { formsListWhere } from '@/lib/user-roles';

// specs/02-form-builder.md "Form list/create/rename/archive in the admin UI".
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const forms = await withOrgContext(session.user.organizationId, (tx) =>
      tx.form.findMany({
        where: formsListWhere(session.user.organizationId, session.user.role, session.user.id),
        orderBy: { updatedAt: 'desc' },
      }),
    );
    return NextResponse.json({ forms });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const createFormBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  templateId: z.enum(FORM_TEMPLATE_IDS).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);

    const { name, templateId } = createFormBodySchema.parse(await request.json());
    const initialSchema = templateId
      ? createSchemaFromTemplate(templateId as FormTemplateId)
      : createEmptyFormSchema();

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const existing = await tx.form.findMany({
        where: { organizationId: session.user.organizationId },
        select: { slug: true },
      });
      const slug = uniqueSlug(slugify(name), new Set(existing.map((f) => f.slug)));

      const form = await tx.form.create({
        data: {
          organizationId: session.user.organizationId,
          name,
          slug,
          createdBy: session.user.id,
        },
      });

      // Every form starts life with one unpublished draft version — the builder always
      // has something to edit, and getOrCreateDraftVersion (src/lib/forms/versions.ts)
      // can rely on "a form always has at least one version" as an invariant.
      const version = await tx.formVersion.create({
        data: {
          formId: form.id,
          organizationId: session.user.organizationId,
          schema: initialSchema,
          versionNumber: 1,
        },
      });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'form.create',
          entityType: 'form',
          entityId: form.id,
        },
        tx,
      );

      return { form, version };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
