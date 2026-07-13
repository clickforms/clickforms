import type { Form, UserRole } from '@prisma/client';
import { NotFoundError } from '@/lib/api-errors';
import { ForbiddenError } from '@/lib/session';
import { canEditForm } from '@/lib/user-roles';

/** Ensures a form exists in the org and the caller may edit it. Returns the form row. */
export function assertFormEditAccess(
  form: Form | null,
  role: UserRole,
  userId: string,
): asserts form is Form {
  if (!form) {
    throw new NotFoundError('Form');
  }
  if (!canEditForm(role, form.createdBy, userId)) {
    throw new ForbiddenError('You do not have permission to edit this form');
  }
}
