import type { ResolvedSubmissionFile } from '@/lib/forms/format-submission-answer';

// Split out of build-submission-export-assets.ts on purpose: this file must stay free of
// server-only imports (no @/lib/s3, no @/lib/db). buildSubmissionExportAssets() there
// imports the AWS SDK to presign S3 URLs, which drags in Node built-ins (fs/net/tls) that
// don't exist in the browser. SubmissionFieldDisplay (submission-field-display.tsx) is now
// rendered client-side too (SubmissionPreviewModal's "what would print" preview, no
// iframe), and a *runtime* import from the same module as buildSubmissionExportAssets —
// even of an unrelated, S3-free export — pulls that whole module's import graph into the
// client bundle, since Next's client/server module graph is traced per-file, not
// per-export. `import type` alone is fine (erased entirely at compile time), but anything
// actually called at runtime (resolveSubmissionFileDataUrl/resolveSubmissionFileName) needs
// to live somewhere with no server-only imports at all — hence this file.

export interface SubmissionExportAssets {
  fieldImages: Record<string, string>;
  submissionFiles: Record<string, string>;
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
