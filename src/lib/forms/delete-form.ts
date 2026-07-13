import type { Form, Prisma } from '@prisma/client';
import { logAudit } from '@/lib/audit';

/** Permanently removes a form and all related versions, submissions, and uploads (DB). */
export async function deleteForm(
  tx: Prisma.TransactionClient,
  form: Form,
  actorUserId: string,
): Promise<{ submissionCount: number }> {
  const submissionCount = await tx.submission.count({ where: { formId: form.id } });

  await logAudit(
    {
      organizationId: form.organizationId,
      actorUserId,
      action: 'form.delete',
      entityType: 'form',
      entityId: form.id,
      metadata: {
        name: form.name,
        slug: form.slug,
        status: form.status,
        submissionCount,
      },
    },
    tx,
  );

  // Form.currentVersionId references form_versions — clear it before the cascade delete.
  await tx.form.update({
    where: { id: form.id },
    data: { currentVersionId: null },
  });

  await tx.form.delete({ where: { id: form.id } });

  return { submissionCount };
}
