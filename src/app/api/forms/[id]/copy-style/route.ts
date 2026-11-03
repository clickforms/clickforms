import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertOrgActionsAllowed } from '@/lib/admin/plan-enforcement';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess, assertFormViewAccess } from '@/lib/form-access';
import { partitionHeaderLogos } from '@/lib/forms/form-title';
import { type FormBranding, type FormField, formSchemaSchema } from '@/lib/forms/schema';
import { buildFormFieldImageKey, copyObject, isFormFieldImageKey } from '@/lib/s3';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ sourceFormId: z.string().uuid() });

/**
 * "Copy style from another form": returns the source form's form-wide branding (fonts,
 * colours, layout, submit button) plus its header logo field(s), with each logo's image
 * copied to a fresh storage key owned by the target form. Nothing is written to the
 * target's schema here — the builder applies the result to its in-memory draft so the
 * change flows through the normal autosave/undo path and the author can review it first.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;
    const { sourceFormId } = bodySchema.parse(await request.json());
    const organizationId = requireOrganizationId(session);

    if (sourceFormId === id) {
      throw new InvalidRequestError('Pick a different form to copy the style from.');
    }

    const { target, source, sourceSchema } = await withOrgContext(organizationId, async (tx) => {
      const target = await tx.form.findFirst({ where: { id, organizationId } });
      assertFormEditAccess(target, session.user.role, session.user.id);
      await assertOrgActionsAllowed(tx, organizationId);

      const source = await tx.form.findFirst({ where: { id: sourceFormId, organizationId } });
      assertFormViewAccess(source, session.user.id);

      const version = await tx.formVersion.findFirst({
        where: { formId: source.id },
        orderBy: { versionNumber: 'desc' },
      });
      const parsed = formSchemaSchema.safeParse(version?.schema);
      if (!parsed.success) {
        throw new InvalidRequestError('The selected form has no readable design.');
      }
      return { target, source, sourceSchema: parsed.data };
    });

    const firstPageFieldIds = sourceSchema.pages[0]?.fields ?? [];
    const { headerLogoIds } = partitionHeaderLogos(firstPageFieldIds, sourceSchema.fields);

    const logos: FormField[] = [];
    for (const logoId of headerLogoIds) {
      const logo = sourceSchema.fields[logoId];
      if (logo?.type !== 'image' || !logo.imageStorageKey) continue;
      if (
        !isFormFieldImageKey({
          storageKey: logo.imageStorageKey,
          organizationId: source.organizationId,
          formId: source.id,
          fieldId: logo.id,
        })
      ) {
        continue;
      }

      const newFieldId = crypto.randomUUID();
      const filename = logo.imageStorageKey
        .split('/')
        .pop()
        ?.replace(/^[0-9a-f-]{36}-/, '');
      const destKey = buildFormFieldImageKey({
        organizationId: target.organizationId,
        formId: target.id,
        fieldId: newFieldId,
        filename: filename || 'logo',
      });
      await copyObject(logo.imageStorageKey, destKey);
      logos.push({ ...logo, id: newFieldId, imageStorageKey: destKey });
    }

    const branding: FormBranding = sourceSchema.branding;
    return NextResponse.json({ branding, logos });
  } catch (error) {
    return toErrorResponse(error);
  }
}
