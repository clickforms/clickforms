import { NextResponse } from 'next/server';
import { NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { getFormSchemaByVersionId, getPublishedFormBySlug } from '@/lib/forms/public-lookup';
import { createPresignedDownloadUrl, isFormFieldImageKey } from '@/lib/s3';

interface RouteContext {
  params: Promise<{ slug: string; fieldId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { slug, fieldId } = await params;
    const form = await getPublishedFormBySlug(slug);
    if (!form.currentVersionId) throw new NotFoundError('Form');

    const schema = await getFormSchemaByVersionId(form.currentVersionId);
    const field = schema.fields[fieldId];
    if (field?.type !== 'image' || !field.imageStorageKey) {
      return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    }

    if (
      !isFormFieldImageKey({
        storageKey: field.imageStorageKey,
        organizationId: form.organizationId,
        formId: form.id,
        fieldId: field.id,
      })
    ) {
      return NextResponse.json({ error: 'Invalid image reference.' }, { status: 404 });
    }

    const url = await createPresignedDownloadUrl({
      storageKey: field.imageStorageKey,
      filename: 'image',
      inline: true,
    });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    return toErrorResponse(error);
  }
}
