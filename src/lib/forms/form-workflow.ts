import type { Form, FormVersion, Prisma } from '@prisma/client';
import { InvalidRequestError, NotFoundError } from '@/lib/api-errors';

function assertNotArchived(form: Form): void {
  if (form.status === 'archived') {
    throw new InvalidRequestError('Archived forms cannot be updated');
  }
}

export async function getLatestFormVersion(
  tx: Prisma.TransactionClient,
  formId: string,
): Promise<FormVersion | null> {
  return tx.formVersion.findFirst({
    where: { formId },
    orderBy: { versionNumber: 'desc' },
  });
}

/** draft → published (or re-activate a previously published version after unpublish) */
export async function publishForm(
  tx: Prisma.TransactionClient,
  form: Form,
): Promise<{ form: Form; version: FormVersion }> {
  assertNotArchived(form);
  if (form.status !== 'draft') {
    throw new InvalidRequestError('Only draft forms can be published');
  }

  const latest = await getLatestFormVersion(tx, form.id);
  if (!latest) throw new NotFoundError('Form version');

  if (latest.publishedAt !== null) {
    const updatedForm = await tx.form.update({
      where: { id: form.id },
      data: { currentVersionId: latest.id, status: 'published' },
    });
    return { form: updatedForm, version: latest };
  }

  const publishedVersion = await tx.formVersion.update({
    where: { id: latest.id },
    data: { publishedAt: new Date() },
  });

  const updatedForm = await tx.form.update({
    where: { id: form.id },
    data: { currentVersionId: publishedVersion.id, status: 'published' },
  });

  return { form: updatedForm, version: publishedVersion };
}

/** Takes the current live version offline (clears currentVersionId) and resets the form
 *  to draft — used for both an explicit "Take offline" and for "Edit form" on a live
 *  form (the confirmation flow in the builder), which is the same transition under the
 *  hood. `intent` only affects the audit log entry the caller writes afterward. */
export async function unpublishForm(
  tx: Prisma.TransactionClient,
  form: Form,
): Promise<{ form: Form; version: FormVersion | null }> {
  assertNotArchived(form);
  if (!form.currentVersionId) {
    throw new InvalidRequestError('This form is not currently live');
  }

  const latest = await getLatestFormVersion(tx, form.id);

  const updatedForm = await tx.form.update({
    where: { id: form.id },
    data: { status: 'draft', currentVersionId: null },
  });

  return { form: updatedForm, version: latest };
}
