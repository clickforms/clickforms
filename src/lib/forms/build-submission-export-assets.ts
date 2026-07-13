import type { SubmissionFile } from '@prisma/client';
import type { ResolvedSubmissionFile } from '@/lib/forms/format-submission-answer';
import type { FormSchema } from '@/lib/forms/schema';
import { createPresignedDownloadUrl } from '@/lib/s3';

export interface SubmissionExportAssets {
  fieldImages: Record<string, string>;
  submissionFiles: Record<string, string>;
}

async function fetchDataUrl(url: string, mimeType?: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const type = mimeType || response.headers.get('content-type') || 'application/octet-stream';
    return `data:${type};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function buildSubmissionExportAssets(params: {
  schema: FormSchema;
  files: SubmissionFile[];
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[];
}): Promise<SubmissionExportAssets> {
  const { schema, files, resolveFiles } = params;
  const fieldImages: Record<string, string> = {};
  const submissionFiles: Record<string, string> = {};

  await Promise.all(
    Object.values(schema.fields).map(async (field) => {
      if (field.type !== 'image' || !field.imageStorageKey) return;
      const url = await createPresignedDownloadUrl({
        storageKey: field.imageStorageKey,
        filename: 'image',
        inline: true,
      });
      const dataUrl = await fetchDataUrl(url, 'image/png');
      if (dataUrl) fieldImages[field.id] = dataUrl;
    }),
  );

  const seenFileIds = new Set<string>();
  for (const field of Object.values(schema.fields)) {
    if (field.type !== 'file_upload' && field.type !== 'signature') continue;
    const resolved = resolveFiles(field.id);
    for (const file of resolved) {
      if (seenFileIds.has(file.id)) continue;
      seenFileIds.add(file.id);
      if (!file.mimeType.startsWith('image/')) continue;
      const dataUrl = await fetchDataUrl(file.url, file.mimeType);
      if (dataUrl) submissionFiles[file.id] = dataUrl;
    }
  }

  for (const file of files) {
    if (seenFileIds.has(file.id)) continue;
    if (!file.mimeType.startsWith('image/')) continue;
    const url = await createPresignedDownloadUrl({
      storageKey: file.storageKey,
      filename: file.filename,
    });
    const dataUrl = await fetchDataUrl(url, file.mimeType);
    if (dataUrl) submissionFiles[file.id] = dataUrl;
  }

  return { fieldImages, submissionFiles };
}

export function resolveSubmissionFileDataUrl(
  assets: SubmissionExportAssets,
  fieldId: string,
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[],
): string | null {
  const resolved = resolveFiles(fieldId);
  for (const file of resolved) {
    const dataUrl = assets.submissionFiles[file.id];
    if (dataUrl) return dataUrl;
  }
  return null;
}

export function resolveSubmissionFileName(
  fieldId: string,
  resolveFiles: (fieldId: string) => ResolvedSubmissionFile[],
): string | null {
  const resolved = resolveFiles(fieldId);
  return resolved[0]?.filename ?? null;
}
