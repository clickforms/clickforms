import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { slugify, uniqueSlug } from '@/lib/forms/slug';
import { requireRole, requireSession } from '@/lib/session';
import { buildOrgFormUrl } from '@/lib/tenant';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Clones a form into a brand-new draft: copies whatever schema the source form is
 * currently showing in the builder (its latest version, published or not — same
 * "latest by versionNumber" read GET /api/forms/[id] uses) into version 1 of a new
 * form. History, status, and current-version pointer are intentionally not carried
 * over — the copy always starts life exactly like a fresh POST /api/forms would.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: session.user.organizationId },
      });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const sourceVersion = await tx.formVersion.findFirst({
        where: { formId: form.id },
        orderBy: { versionNumber: 'desc' },
      });

      const existing = await tx.form.findMany({
        where: { organizationId: session.user.organizationId },
        select: { slug: true },
      });
      const name = `${form.name} (copy)`;
      const slug = uniqueSlug(slugify(name), new Set(existing.map((f) => f.slug)));

      const newForm = await tx.form.create({
        data: {
          organizationId: session.user.organizationId,
          name,
          slug,
          createdBy: session.user.id,
        },
      });

      const version = await tx.formVersion.create({
        data: {
          formId: newForm.id,
          organizationId: session.user.organizationId,
          schema: sourceVersion?.schema ?? {},
          versionNumber: 1,
        },
      });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'form.duplicate',
          entityType: 'form',
          entityId: newForm.id,
          metadata: { sourceFormId: form.id },
        },
        tx,
      );

      // FormsListClient (a client component) prepends the duplicated form straight into
      // its list without a full page reload, so it needs the same absolute publicUrl
      // page.tsx computes for the initial load — building it here keeps that logic
      // server-side rather than shipping ROOT_DOMAIN/buildOrgFormUrl to the client.
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: session.user.organizationId },
        select: { subdomain: true },
      });
      const publicUrl = buildOrgFormUrl(organization.subdomain, `/f/${newForm.slug}`);

      return { form: { ...newForm, publicUrl }, version };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
