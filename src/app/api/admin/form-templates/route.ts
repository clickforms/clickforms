import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { createEmptyFormSchema } from '@/lib/forms/schema';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

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
 * Lists every template regardless of status, for /admin/templates. Deliberately a plain
 * `prisma` query, not `withOrgContext` — FormTemplate has no organizationId (see its
 * doc comment in prisma/schema.prisma), same exception as the rest of /admin's
 * org-less tables (PlatformAdminInvite, EmailLog).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);

    const templates = await prisma.formTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      select: TEMPLATE_LIST_SELECT,
    });

    return NextResponse.json({
      templates: templates.map((template) => ({
        ...template,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const createTemplateBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(1000).optional(),
  industry: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  formType: z.string().trim().max(100).optional(),
});

/** Creates a new template shell (empty schema, draft status) and redirects the admin
 * straight into its builder — mirrors how POST /api/forms starts a brand-new form. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);

    const body = createTemplateBodySchema.parse(await request.json());

    const template = await prisma.formTemplate.create({
      data: {
        name: body.name,
        description: body.description || null,
        industry: body.industry || null,
        category: body.category || null,
        formType: body.formType || null,
        schema: createEmptyFormSchema(),
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
