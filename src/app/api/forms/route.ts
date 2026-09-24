import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertCanCreateForm, assertOrgActionsAllowed } from '@/lib/admin/plan-limits';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { prisma, withOrgContext } from '@/lib/db';
import { createEmptyFormSchema, type FormSchema } from '@/lib/forms/schema';
import { slugify, uniqueSlug } from '@/lib/forms/slug';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';
import { formsListWhere } from '@/lib/user-roles';

// specs/02-form-builder.md "Form list/create/rename/archive in the admin UI".
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const forms = await withOrgContext(session.user.organizationId, (tx) =>
      tx.form.findMany({
        where: formsListWhere(requireOrganizationId(session), session.user.role, session.user.id),
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

      // Strip any dummy image the template author uploaded while designing the
      // template (see FieldImageUpload in the admin template builder). Its storageKey
      // lives under templates/<templateId>/fields/<fieldId>/... — outside every
      // organisation's key prefix — so isFormFieldImageKey would reject it as an
      // "Invalid image reference" 404 the moment this new form tried to display it.
      // Rather than ship every form created from an image-bearing template with a
      // permanently broken image, drop the reference here: the field itself, its
      // label, and its alt text all carry over intact, and the organisation uploads
      // its own image the normal way (matches the existing expectation, documented on
      // template-builder-client.tsx, that "the organisation using the template can add
      // their own after copying it").
      for (const field of Object.values(initialSchema.fields)) {
        // draw_on_image carries the exact same template-scoped imageStorageKey
        // convention as image (see the schema comment on drawOnImageFieldSchema) — same
        // stale-reference problem, same fix.
        if ((field.type === 'image' || field.type === 'draw_on_image') && field.imageStorageKey) {
          field.imageStorageKey = undefined;
        }
      }
    }

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      await assertOrgActionsAllowed(tx, requireOrganizationId(session));

      const organization = await tx.organization.findUnique({
        where: { id: requireOrganizationId(session) },
        select: { plan: true },
      });
      // Falls back to 'standard' only if the org row is somehow missing by the time this
      // runs (can't happen in practice — requireSession already resolved this org) rather
      // than throwing here and turning a data anomaly into a confusing 500 on form create.
      await assertCanCreateForm(
        tx,
        requireOrganizationId(session),
        organization?.plan ?? 'standard',
      );

      const existing = await tx.form.findMany({
        where: { organizationId: requireOrganizationId(session) },
        select: { slug: true },
      });
      const slug = uniqueSlug(slugify(name), new Set(existing.map((f) => f.slug)));

      const form = await tx.form.create({
        data: {
          organizationId: requireOrganizationId(session),
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
          organizationId: requireOrganizationId(session),
          schema: initialSchema,
          versionNumber: 1,
        },
      });

      await logAudit(
        {
          organizationId: requireOrganizationId(session),
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
