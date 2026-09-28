import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import type { FormSchema } from '@/lib/forms/schema';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const TEMPLATE_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  industry: true,
  category: true,
  formType: true,
  status: true,
  thumbnailStorageKey: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Clones a template into a brand-new draft — the admin-side analogue of
 * POST /api/forms/[id]/duplicate. Always lands as 'draft' regardless of the source
 * template's status, same reasoning as the form version: a copy is a starting point to
 * edit, never something that should go live (or stay archived) just because its source
 * did.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const source = await prisma.formTemplate.findUnique({ where: { id } });
    if (!source) throw new NotFoundError('Template');

    // Deep-cloned, not referenced — same reasoning as using a template to create a Form
    // (see FormTemplate's doc comment): the copy must never alias the source's own
    // schema object.
    const schema = structuredClone(source.schema) as FormSchema;

    // Strip any image the source template author uploaded — its storageKey is
    // `templates/<source-template-id>/fields/<fieldId>/...` (see
    // buildTemplateFieldImageKey in src/lib/s3.ts), scoped to the *source* template's id.
    // The duplicate gets its own id, so isTemplateFieldImageKey would reject that key as
    // an "Invalid image reference" 404 the moment the duplicate tried to display it.
    // Rather than ship a duplicate with a permanently broken image, drop the reference
    // here — same fix POST /api/forms already applies when a Form is created from a
    // template. The field, its label, and its alt text all carry over intact; the admin
    // re-uploads the image on the duplicate the normal way.
    for (const field of Object.values(schema.fields)) {
      if ((field.type === 'image' || field.type === 'draw_on_image') && field.imageStorageKey) {
        field.imageStorageKey = undefined;
      }
    }

    // thumbnailStorageKey is left out entirely for the same reason (templates/<source-
    // id>/thumbnail/... — see buildTemplateThumbnailKey) — not copied to the new row.

    const template = await prisma.formTemplate.create({
      data: {
        name: `${source.name} (copy)`,
        description: source.description,
        industry: source.industry,
        category: source.category,
        formType: source.formType,
        status: 'draft',
        schema,
        createdBy: session.user.id,
      },
      select: TEMPLATE_LIST_SELECT,
    });

    return NextResponse.json(
      {
        template: {
          ...template,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
