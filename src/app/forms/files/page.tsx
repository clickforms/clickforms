import { getServerSession } from 'next-auth';
import { type FileRow, FilesClient } from '@/app/forms/files/files-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { createDownloadUrlMap } from '@/lib/forms/submission-files';
import { createPresignedDownloadUrl } from '@/lib/s3';
import { canManageUsers, formsListWhere } from '@/lib/user-roles';

/** Org Files page — library uploads plus files from submissions the user can see.
 * Admins/editors see every non-private form; members see the same forms they can
 * open on the Forms list. Library upload/delete stays admin-only. */
export default async function FilesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const canManageLibrary = canManageUsers(session.user.role);
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return null;
  }

  const { libraryFiles, submissionFiles } = await withOrgContext(organizationId, async (tx) => {
    const [libraryFiles, submissionFiles] = await Promise.all([
      tx.organizationFile.findMany({
        where: { organizationId },
        orderBy: { uploadedAt: 'desc' },
      }),
      tx.submissionFile.findMany({
        where: {
          organizationId,
          submission: {
            status: { not: 'in_progress' },
            form: formsListWhere(organizationId, session.user.role, session.user.id),
          },
        },
        orderBy: { uploadedAt: 'desc' },
        include: {
          submission: {
            select: {
              id: true,
              status: true,
              submittedAt: true,
              form: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);
    return { libraryFiles, submissionFiles };
  });

  let downloadsUnavailableReason: string | null = null;
  const downloadUrlById = new Map<string, string>();

  try {
    if (submissionFiles.length > 0) {
      const submissionUrls = await createDownloadUrlMap(submissionFiles);
      for (const [id, url] of submissionUrls) {
        downloadUrlById.set(id, url);
      }
    }
    await Promise.all(
      libraryFiles.map(async (file) => {
        const url = await createPresignedDownloadUrl({
          storageKey: file.storageKey,
          filename: file.filename,
        });
        downloadUrlById.set(file.id, url);
      }),
    );
  } catch (error) {
    downloadsUnavailableReason =
      error instanceof Error ? error.message : 'Could not generate download links.';
  }

  const libraryRows: FileRow[] = libraryFiles.map((file) => ({
    id: file.id,
    source: 'library',
    filename: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    uploadedAt: file.uploadedAt.toISOString(),
    submittedAt: file.uploadedAt.toISOString(),
    statusLabel: 'Active',
    statusClassName: 'badge--success',
    fieldKey: null,
    formId: null,
    formName: null,
    submissionId: null,
    downloadUrl: downloadUrlById.get(file.id) ?? null,
  }));

  const submissionRows: FileRow[] = submissionFiles.map((file) => {
    const status =
      file.submission.status === 'approved'
        ? { label: 'Approved', className: 'badge--approved' }
        : file.submission.status === 'rejected'
          ? { label: 'Rejected', className: 'badge--error' }
          : { label: 'Submitted', className: 'badge--neutral' };

    return {
      id: file.id,
      source: 'submission',
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedAt: file.uploadedAt.toISOString(),
      submittedAt: (file.submission.submittedAt ?? file.uploadedAt).toISOString(),
      statusLabel: status.label,
      statusClassName: status.className,
      fieldKey: file.fieldKey,
      formId: file.submission.form.id,
      formName: file.submission.form.name,
      submissionId: file.submission.id,
      downloadUrl: downloadUrlById.get(file.id) ?? null,
    };
  });

  const rows = [...libraryRows, ...submissionRows].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );

  return (
    <FilesClient
      initialFiles={rows}
      downloadsUnavailableReason={downloadsUnavailableReason}
      canManageLibrary={canManageLibrary}
    />
  );
}
