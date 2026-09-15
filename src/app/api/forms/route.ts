import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma, withOrgContext } from '@/lib/db';
import { createEmptyFormSchema, type FormSchema } from '@/lib/forms/schema';
import { slugify, uniqueSlug } from '@/lib/forms/slug';
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
  // A FormTemplate id (see prisma/schema.prisma) rather than a fixed enum — the
  // template library is admin-managed data, not a compile-time list. Looked up below
  // rather than trusted as-is, same defense-in-depth as any other client-supplied id.
  templateId: z.string().uuid().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);

    const { name, templateId } = createFormBodySchema.parse(await request.json());

    let initialSchema = createEmptyFormSchema();
    if (templateId) {
      // Only published templates are offered by GET /api/form-templates — re-checked
      // here so a stale/archived/draft id can't be used to smuggle in a template that
      // was never (or is no longer) meant for general use.
      const template = await prisma.formTemplate.findUnique({
        where: { id: templateId },
        select: { status: true, schema: true },
      });
      if (template?.status !== 'published') {
        throw new InvalidRequestError('This template is not available.');
      }
      // Deep-cloned, not referenced — see FormTemplate's doc comment: using a template
      // is a one-time snapshot, so this organisation's copy must never alias the
      // template's own schema object.
      initialSchema = structuredClone(template.schema) as FormSchema;
    }

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
