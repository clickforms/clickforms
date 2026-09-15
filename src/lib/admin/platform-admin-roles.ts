import type { PlatformAdminRole } from '@prisma/client';

/** Roles selectable when inviting someone to the /admin "Team" page. */
export const PLATFORM_ADMIN_ROLES = [
  'super_admin',
  'support',
] as const satisfies readonly PlatformAdminRole[];

export const PLATFORM_ADMIN_ROLE_LABELS: Record<PlatformAdminRole, string> = {
  super_admin: 'Super admin',
  support: 'Support (read-only)',
};

// NOTE: both roles currently get identical access — src/lib/session.ts
// requirePlatformAdmin() only checks the boolean `isPlatformAdmin` flag, not this role.
// `support` exists so invites can label someone's intended scope; enforcing a real
// read-only restriction is follow-up work, not yet wired into any /admin route.
export const PLATFORM_ADMIN_ROLE_DESCRIPTIONS: Record<PlatformAdminRole, string> = {
  super_admin: 'Full access to every organisation, billing, and the Team page itself.',
  support: 'Intended for support scenarios. Not yet access-restricted — full access today.',
};
