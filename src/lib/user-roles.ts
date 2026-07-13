import type { UserRole } from '@prisma/client';

/** Roles an org admin can assign when inviting someone. */
export const INVITABLE_ROLES = ['admin', 'member'] as const satisfies readonly UserRole[];

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ROLE_LABELS: Record<InvitableRole, string> = {
  admin: 'Organisation admin',
  member: 'Regular user',
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

/** Prisma `where` clause for listing forms this user can see in the admin UI. */
export function formsListWhere(organizationId: string, role: UserRole, userId: string) {
  const base = { organizationId };
  if (role === 'member') {
    return { ...base, createdBy: userId };
  }
  return base;
}

/** Derived UI flag: show builder controls (not read-only). */
export function canUseBuilder(role: UserRole, createdBy: string | null, userId: string): boolean {
  if (!createdBy) return canEditAnyForm(role) || role === 'member';
  return canEditForm(role, createdBy, userId);
}

export function formatUserRole(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Organisation admin';
    case 'member':
      return 'Regular user';
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
