import type { UserRole } from '@prisma/client';
import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

// Module augmentation for next-auth v4 — adds the org-scoping fields spec
// 01-data-model-and-auth.md requires on every session (userId, organizationId, role)
// so route handlers get them typed instead of reading through `as` casts everywhere.

declare module 'next-auth' {
  interface User extends DefaultUser {
    organizationId: string;
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      organizationId: string;
      role: UserRole;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    userId: string;
    organizationId: string;
    role: UserRole;
  }
}
