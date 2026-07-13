import type { Prisma, Submission, SubmissionFile } from '@prisma/client';
import type { ResolvedSubmissionFile } from '@/lib/forms/format-submission-answer';
import { createEmptyFormSchema, type FormSchema, formSchemaSchema } from '@/lib/forms/schema';
import { createPresignedDownloadUrl } from '@/lib/s3';

export function buildSubmissionFileMaps(files: SubmissionFile[]) {
  const filesById = new Map(files.map((file) => [file.id, file]));
  const filesByFieldKey = new Map<string, SubmissionFile[]>();

  for (const file of files) {
    const existing = filesByFieldKey.get(file.fieldKey);
    if (existing) {
      existing.push(file);
    } else {
      filesByFieldKey.set(file.fieldKey, [file]);
    }
  }

  return { filesById, filesByFieldKey };
}

export async function createDownloadUrlMap(files: SubmissionFile[]): Promise<Map<string, string>> {
  const downloadUrlById = new Map<string, string>();
  await Promise.all(
    files.map(async (file) => {
      const url = await createPresignedDownloadUrl({
        storageKey: file.storageKey,
        filename: file.filename,
      });
      downloadUrlById.set(file.id, url);
    }),
  );
  return downloadUrlById;
}

export function createSubmissionFileResolver(
  answers: Record<string, unknown>,
  filesById: Map<string, SubmissionFile>,
  filesByFieldKey: Map<string, SubmissionFile[]>,
  downloadUrlById: Map<string, string>,
): (fieldId: string) => ResolvedSubmissionFile[] {
  return (fieldId: string) => {
    const rawValue = answers[fieldId];
    const fileIds = Array.isArray(rawValue)
      ? rawValue.filter((entry): entry is string => typeof entry === 'string')
      : typeof rawValue === 'string' && rawValue
        ? [rawValue]
        : [];

    const resolved: ResolvedSubmissionFile[] = [];
    for (const fileId of fileIds) {
      const file = filesById.get(fileId);
      const url = downloadUrlById.get(fileId);
      if (file && url) {
        resolved.push({ id: file.id, filename: file.filename, url, mimeType: file.mimeType });
      }
    }

    if (resolved.length > 0) {
      return resolved;
    }

    const fallback = filesByFieldKey.get(fieldId) ?? [];
    for (const file of fallback) {
      const url = downloadUrlById.get(file.id);
      if (url) {
        resolved.push({ id: file.id, filename: file.filename, url, mimeType: file.mimeType });
      }
    }

    return resolved;
  };
}

export function parseSubmissionAnswers(submission: Submission): Record<string, unknown> {
  return (submission.answers ?? {}) as unknown as Record<string, unknown>;
}

/** Loads and parses the exact form_version schema a submission was created against
 * (org-scoped, inside the caller's RLS tx) — shared by the admin submission-detail page
 * and the admin edit/upload routes below so they never validate an edit against a
 * different (e.g. currently-published) version than the one the submission's answers
 * actually shape-match. Falls back to an empty schema (rather than throwing) on a
 * missing/corrupt version, matching the submission-detail page's existing behavior. */
export async function loadSubmissionFormSchema(
  tx: Prisma.TransactionClient,
  submission: Pick<Submission, 'id' | 'formVersionId'>,
  organizationId: string,
): Promise<FormSchema> {
  const version = await tx.formVersion.findFirst({
    where: { id: submission.formVersionId, organizationId },
  });
  if (!version) {
    console.error(
      `[forms] submission ${submission.id} references missing form_version ${submission.formVersionId}`,
    );
    return createEmptyFormSchema();
  }

  const parsed = formSchemaSchema.safeParse(version.schema);
  if (!parsed.success) {
    console.error(
      `[forms] form_version ${version.id} (submission ${submission.id}) failed formSchemaSchema`,
      parsed.error,
    );
    return createEmptyFormSchema();
  }
  return parsed.data;
}
