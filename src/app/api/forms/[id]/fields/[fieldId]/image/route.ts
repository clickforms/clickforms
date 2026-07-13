import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { formSchemaSchema } from '@/lib/forms/schema';
import {
  assertLogoUploadAllowed,
  buildFormFieldImageKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  isFormFieldImageKey,
} from '@/lib/s3';
import { requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; fieldId: string }>;
}

async function getFormField(formId: string, fieldId: string, organizationId: string) {
  return withOrgContext(organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id: formId, organizationId },
    });
    if (!form) return null;

    const version = await tx.formVersion.findFirst({
      where: { formId: form.id },
      orderBy: { versionNumber: 'desc' },
    });
    if (!version) return null;

    const parsed = formSchemaSchema.safeParse(version.schema);
    if (!parsed.success) return null;

    const field = parsed.data.fields[fieldId];
    if (field?.type !== 'image') return null;

    return { form, field };
  });
}

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { id, fieldId } = await params;

    const result = await getFormField(id, fieldId, session.user.organizationId);
    const storageKey = result?.field.imageStorageKey;
    if (!result || !storageKey) {
      return NextResponse.json({ error: 'This field has no uploaded image.' }, { status: 404 });
    }

    const { form, field } = result;
    if (
      !isFormFieldImageKey({
        storageKey,
        organizationId: form.organizationId,
        formId: form.id,
        fieldId: field.id,
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
    requireRole(session, ['admin', 'editor', 'member']);
    const { id, fieldId } = await params;
    const body = presignBodySchema.parse(await request.json());

    assertLogoUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    const result = await getFormField(id, fieldId, session.user.organizationId);
    if (!result) throw new NotFoundError('Field');
    assertFormEditAccess(result.form, session.user.role, session.user.id);

    const storageKey = buildFormFieldImageKey({
      organizationId: result.form.organizationId,
      formId: result.form.id,
      fieldId: result.field.id,
      filename: body.filename,
    });
    const uploadUrl = await createPresignedUploadUrl({ storageKey, mimeType: body.mimeType });

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
    requireRole(session, ['admin', 'editor', 'member']);
    const { id, fieldId } = await params;
    const body = confirmBodySchema.parse(await request.json());

    const result = await getFormField(id, fieldId, session.user.organizationId);
    if (!result) throw new NotFoundError('Field');
    assertFormEditAccess(result.form, session.user.role, session.user.id);

    if (
      !isFormFieldImageKey({
        storageKey: body.storageKey,
        organizationId: result.form.organizationId,
        formId: result.form.id,
        fieldId: result.field.id,
      })
    ) {
      return NextResponse.json(
        { error: 'storageKey does not belong to this field.' },
        { status: 400 },
      );
    }

    assertLogoUploadAllowed({ mimeType: body.mimeType, sizeBytes: body.sizeBytes });

    return NextResponse.json({ storageKey: body.storageKey });
  } catch (error) {
    return toErrorResponse(error);
  }
}
