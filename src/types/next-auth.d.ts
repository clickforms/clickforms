import type { UserRole } from '@prisma/client';
import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

// Module augmentation for next-auth v4 — adds the org-scoping fields spec
// 01-data-model-and-auth.md requires on every session (userId, organizationId, role)
// so route handlers get them typed instead of reading through `as` casts everywhere.

declare module 'next-auth' {
  interface User extends DefaultUser {
    organizationId: string | null;
    role: UserRole;
    // Platform-staff flag — see prisma/schema.prisma User.isPlatformAdmin and
    // src/lib/session.ts requirePlatformAdmin(). Orthogonal to `role`. Clickforms
    // staff who only use /admin have organizationId = null.
    isPlatformAdmin: boolean;
    // True only while this platform admin has an active (leftAt: null)
    // PlatformAdminOrgAccess row for `organizationId` — i.e. they used "Join this
    // organisation" from /admin rather than being a genuine org employee who also
    // happens to be a platform admin. Drives the "Leave organisation" banner in the
    // org workspace — see src/lib/auth.ts isTemporaryOrgJoin().
    isTemporaryOrgJoin: boolean;
  }

  interface Session {
    user: {
      id: string;
      organizationId: string | null;
      role: UserRole;
      isPlatformAdmin: boolean;
      isTemporaryOrgJoin: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    userId: string;
    organizationId: string | null;
    role: UserRole;
    isPlatformAdmin: boolean;
    isTemporaryOrgJoin: boolean;
  }
}
