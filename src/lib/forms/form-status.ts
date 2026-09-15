import type { FormStatus } from '@prisma/client';

export const FORM_STATUS_LABEL: Record<FormStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
};

export const FORM_STATUS_BADGE_CLASS: Record<FormStatus, string> = {
  draft: 'badge--draft',
  approved: 'badge--approved',
  published: 'badge--success',
  archived: 'badge--neutral',
};

/** Restoring an archived form returns to published if a live version exists, otherwise draft. */
export function restoreStatusAfterUnarchive(currentVersionId: string | null): FormStatus {
  return currentVersionId ? 'published' : 'draft';
}

/** Editing a published form's schema takes it back to draft — it must be explicitly
 *  published again before the edit reaches respondents (see form-workflow.ts). */
export function shouldResetToDraftOnSchemaEdit(status: FormStatus): boolean {
  return status === 'published';
}
