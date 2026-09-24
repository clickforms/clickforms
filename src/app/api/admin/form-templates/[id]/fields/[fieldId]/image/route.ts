import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { formSchemaSchema } from '@/lib/forms/schema';
import {
  assertLogoUploadAllowed,
  buildTemplateFieldImageKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  isTemplateFieldImageKey,
} from '@/lib/s3';
import { requirePlatformAdmin, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; fieldId: string }>;
}

// Template-scoped analogue of /api/forms/[id]/fields/[fieldId]/image — see that route
// for the presign/PUT/confirm flow this mirrors. A FormTemplate has no organizationId
// (it's platform-owned, not tenant data), so this exists as a separate route rather
// than trying to make the tenant route branch on "form or template" — see the doc
// comment on buildTemplateFieldImageKey in src/lib/s3.ts for the key-shape rationale.

async function getTemplateField(templateId: string, fieldId: string) {
  const template = await prisma.formTemplate.findUnique({ where: { id: templateId } });
  if (!template) return null;

  const parsed = formSchemaSchema.safeParse(template.schema);
  if (!parsed.success) return null;

  const field = parsed.data.fields[fieldId];
  // draw_on_image reuses this same route for its template-authored background image —
  // same imageStorageKey convention as the image field type (see the matching widening
  // in the tenant-form version of this route).
  if (field?.type !== 'image' && field?.type !== 'draw_on_image') return null;

  return { template, field };
}

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id, fieldId } = await params;

    const result = await getTemplateField(id, fieldId);
    const storageKey = result?.field.imageStorageKey;
    if (!result || !storageKey) {
      return NextResponse.json({ error: 'This field has no uploaded image.' }, { status: 404 });
    }

    if (
      !isTemplateFieldImageKey({
        storageKey,
        templateId: result.template.id,
        fieldId: result.field.id,
      })
    ) {
      return NextResponse.json({ error: 'Invalid image reference.' }, { status: 404 });
    }

    const url = await createPresignedDownloadUrl({
      storageKey,
      filename: 'image',
      inline: true,
    });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    return toErrorResponse(error);
  }
}

const presignBodySchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id, fieldId } = await params;
    const body = presignBodySchema.parse(await request.json());

    assertLogoUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    const result = await getTemplateField(id, fieldId);
    if (!result) throw new NotFoundError('Field');

    const storageKey = buildTemplateFieldImageKey({
      templateId: result.template.id,
      fieldId: result.field.id,
      filename: body.filename,
    });
    const uploadUrl = await createPresignedUploadUrl({
      storageKey,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    return NextResponse.json({ uploadUrl, storageKey });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const confirmBodySchema = z.object({
  storageKey: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export async function PUT(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requirePlatformAdmin(session);
    const { id, fieldId } = await params;
    const body = confirmBodySchema.parse(await request.json());

    const result = await getTemplateField(id, fieldId);
    if (!result) throw new NotFoundError('Field');

    if (
      !isTemplateFieldImageKey({
        storageKey: body.storageKey,
        templateId: result.template.id,
        fieldId: result.field.id,
      })
    ) {
      return NextResponse.json(
        { error: 'storageKey does not belong to this field.' },
        { status: 400 },
      );
    }

    assertLogoUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    // Same posture as the tenant route: this only validates the key and returns it —
    // persisting it onto the field (imageStorageKey) happens via the template
    // builder's normal onUpdateField + Save flow, same as every other field patch.
    return NextResponse.json({ storageKey: body.storageKey });
  } catch (error) {
    return toErrorResponse(error);
  }
}
