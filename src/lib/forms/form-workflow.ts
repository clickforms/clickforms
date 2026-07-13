import type { Form, FormVersion, Prisma } from '@prisma/client';
import { InvalidRequestError, NotFoundError } from '@/lib/api-errors';
import { getOrCreateDraftVersion } from '@/lib/forms/versions';

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

/** draft → approved */
export async function approveForm(
  tx: Prisma.TransactionClient,
  form: Form,
): Promise<{ form: Form; version: FormVersion }> {
  assertNotArchived(form);
  if (form.status !== 'draft') {
    throw new InvalidRequestError('Only draft forms can be approved');
  }

  const latest = await getLatestFormVersion(tx, form.id);
  if (!latest) throw new NotFoundError('Form version');

  if (latest.publishedAt !== null) {
    throw new InvalidRequestError(
      'Save your changes before approving — the current version is already published',
    );
  }

  const updatedForm = await tx.form.update({
    where: { id: form.id },
    data: { status: 'approved' },
  });

  return { form: updatedForm, version: latest };
}

/** approved → published (or re-activate a previously published version after unpublish) */
export async function publishForm(
  tx: Prisma.TransactionClient,
  form: Form,
): Promise<{ form: Form; version: FormVersion }> {
  assertNotArchived(form);
  if (form.status !== 'approved') {
    throw new InvalidRequestError('Form must be approved before it can be published');
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

/** published → approved (take offline, keep approval) */
export async function unpublishForm(
  tx: Prisma.TransactionClient,
  form: Form,
): Promise<{ form: Form; version: FormVersion | null }> {
  assertNotArchived(form);
  if (form.status !== 'published') {
    throw new InvalidRequestError('Only published forms can be unpublished');
  }

  const latest = await getLatestFormVersion(tx, form.id);

  const updatedForm = await tx.form.update({
    where: { id: form.id },
    data: { status: 'approved', currentVersionId: null },
  });

  return { form: updatedForm, version: latest };
}

/** approved | published → draft (take offline and return to editing) */
export async function revertFormToDraft(
  tx: Prisma.TransactionClient,
  form: Form,
): Promise<{ form: Form; version: FormVersion }> {
  assertNotArchived(form);
  if (form.status !== 'approved' && form.status !== 'published') {
    throw new InvalidRequestError('Only approved or published forms can be reverted to draft');
  }

  const latest = await getLatestFormVersion(tx, form.id);
  if (!latest) throw new NotFoundError('Form version');

  const editableVersion =
    latest.publishedAt !== null ? await getOrCreateDraftVersion(tx, form) : latest;

  const updatedForm = await tx.form.update({
    where: { id: form.id },
    data: { status: 'draft', currentVersionId: null },
  });

  return { form: updatedForm, version: editableVersion };
}
