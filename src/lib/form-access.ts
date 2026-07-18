import type { Form, UserRole } from '@prisma/client';
import { NotFoundError } from '@/lib/api-errors';
import { ForbiddenError } from '@/lib/session';
import { canEditForm, canViewForm } from '@/lib/user-roles';

/**
 * Ensures a form exists and is visible to the caller (read-only access — e.g. viewing
 * responses). A private form belonging to someone else 404s rather than 403s, so its
 * existence isn't leaked to non-creators.
 */
export function assertFormViewAccess(form: Form | null, userId: string): asserts form is Form {
  if (!form || !canViewForm(form.isPrivate, form.createdBy, userId)) {
    throw new NotFoundError('Form');
  }
}

/** Ensures a form exists, is visible to the caller, and the caller may edit it. */
export function assertFormEditAccess(
  form: Form | null,
  role: UserRole,
  userId: string,
): asserts form is Form {
  assertFormViewAccess(form, userId);
  if (!canEditForm(role, form.createdBy, userId)) {
    throw new ForbiddenError('You do not have permission to edit this form');
  }
}
