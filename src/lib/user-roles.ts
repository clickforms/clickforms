import type { UserRole } from '@prisma/client';

/** Roles an org admin can assign when inviting someone. */
export const INVITABLE_ROLES = ['admin', 'member'] as const satisfies readonly UserRole[];

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ROLE_LABELS: Record<InvitableRole, string> = {
  admin: 'Org super admin',
  member: 'Org user',
};

export const ROLE_DESCRIPTIONS: Record<InvitableRole, string> = {
  admin: 'Full control over forms, responses, users, and organisational settings.',
  member: 'Access and manage only their own forms and responses.',
};

export function canManageUsers(role: UserRole): boolean {
  return role === 'admin';
}

/** Can create and edit any form in the organisation. */
export function canEditAnyForm(role: UserRole): boolean {
  return role === 'admin' || role === 'editor';
}

/** Can create new forms. */
export function canCreateForms(role: UserRole): boolean {
  return role === 'admin' || role === 'editor' || role === 'member';
}

/** Whether this user may edit a specific form (builder, publish, etc.). */
export function canEditForm(role: UserRole, createdBy: string, userId: string): boolean {
  if (canEditAnyForm(role)) return true;
  if (role === 'member') return createdBy === userId;
  return false;
}

/**
 * Prisma `where` clause for listing forms this user can see in the admin UI. Every org
 * member sees every form by default, regardless of role — a form's creator can opt it
 * out via the `isPrivate` flag, which hides it from everyone but themselves (no
 * admin/editor override; see canViewForm).
 */
export function formsListWhere(organizationId: string, _role: UserRole, userId: string) {
  return {
    organizationId,
    OR: [{ isPrivate: false }, { createdBy: userId }],
  };
}

/**
 * Whether this user may see a form at all. `isPrivate` forms are visible only to their
 * creator — truly private, with no role-based override (not even admin/editor).
 */
export function canViewForm(isPrivate: boolean, createdBy: string, userId: string): boolean {
  return !isPrivate || createdBy === userId;
}

/** Derived UI flag: show builder controls (not read-only). */
export function canUseBuilder(role: UserRole, createdBy: string | null, userId: string): boolean {
  if (!createdBy) return canEditAnyForm(role) || role === 'member';
  return canEditForm(role, createdBy, userId);
}

export function formatUserRole(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Org super admin';
    case 'member':
      return 'Org user';
    case 'editor':
      return 'Editor';
    case 'viewer':
      return 'Viewer';
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}
