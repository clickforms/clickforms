import type { SubmissionFile } from '@prisma/client';
import type { ResolvedSubmissionFile } from '@/lib/forms/format-submission-answer';
import type { FormSchema } from '@/lib/forms/schema';
import type { SubmissionExportAssets } from '@/lib/forms/submission-export-assets';
import { createPresignedDownloadUrl } from '@/lib/s3';

// Server-only: builds the actual data URLs (presigns against S3, then fetches and
// base64-encodes each file). resolveSubmissionFileDataUrl/resolveSubmissionFileName —
// the read side, safe to call from client components too — live in
// submission-export-assets.ts instead; see that file's comment for why the split matters.

async function fetchDataUrl(url: string, mimeType?: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Was a silent `return null` before — that made a broken embed indistinguishable
      // from "nothing to embed" (both just fall back to showing the filename). Logging
      // here is what surfaces a bad presigned URL, expired bucket creds, etc. in the
      // server terminal instead of failing invisibly. S3 error responses are XML with the
      // actual reason (e.g. AuthorizationQueryParametersError, InvalidArgument) in the
      // body — the status/statusText alone ("400 Bad Request") doesn't say why, so log
      // the body too.
      const body = await response.text().catch(() => '<unreadable body>');
      console.error(
        `[forms] fetchDataUrl: presigned GET failed with ${response.status} ${response.statusText}\n${body}`,
      );
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const type = mimeType || response.headers.get('content-type') || 'application/octet-stream';
    return `data:${type};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('[forms] fetchDataUrl: failed to fetch/encode file for embedding', error);
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
