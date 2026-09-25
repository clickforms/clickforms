import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { formSchemaSchema } from '@/lib/forms/schema';
import { deleteObject } from '@/lib/s3';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const TEMPLATE_DETAIL_SELECT = {
  id: true,
  name: true,
  description: true,
  industry: true,
  category: true,
  formType: true,
  status: true,
  schema: true,
  thumbnailStorageKey: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Full detail for one template, including its schema — used by both the settings
 * panel and the template builder. Platform admin only. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const template = await prisma.formTemplate.findUnique({
      where: { id },
      select: TEMPLATE_DETAIL_SELECT,
    });
    if (!template) throw new NotFoundError('Template');

    return NextResponse.json({
      template: {
        ...template,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const patchTemplateBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  industry: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  formType: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  // No versioning here (unlike Form/FormVersion) — a template is a single row with one
  // current schema, since "using" it always produces a fresh, independent Form/
  // FormVersion for the organisation. See FormTemplate's doc comment.
  schema: formSchemaSchema.optional(),
});

/** Updates a template's metadata, status, and/or schema. Platform admin only. */
export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;
    const body = patchTemplateBodySchema.parse(await request.json());

    const existing = await prisma.formTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Template');

    const template = await prisma.formTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.industry !== undefined ? { industry: body.industry || null } : {}),
        ...(body.category !== undefined ? { category: body.category || null } : {}),
        ...(body.formType !== undefined ? { formType: body.formType || null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.schema !== undefined ? { schema: body.schema } : {}),
      },
      select: TEMPLATE_DETAIL_SELECT,
    });

    return NextResponse.json({
      template: {
        ...template,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Permanently deletes a template. Never touches any Form already copied from it — see
 * FormTemplate's doc comment on copy being a one-time snapshot. Platform admin only. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id } = await params;

    const existing = await prisma.formTemplate.findUnique({
      where: { id },
      select: { id: true, name: true, thumbnailStorageKey: true },
    });
    if (!existing) throw new NotFoundError('Template');

    await prisma.formTemplate.delete({ where: { id } });

    if (existing.thumbnailStorageKey) {
      try {
        await deleteObject(existing.thumbnailStorageKey);
      } catch {
        // Best-effort, see deleteObject's doc comment.
      }
    }

    console.info(
      `[admin] template deleted: ${existing.name} (${existing.id}) by ${session.user.email}`,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
