import type { UserRole } from '@prisma/client';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/lib/auth';

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Single entry point for "is there a signed-in admin user" in App Router route handlers.
 * Every admin API route (specs/02-form-builder.md onward) calls this first and lets
 * UnauthorizedError propagate to a shared catch that turns it into a 401 — see
 * `toErrorResponse` in src/lib/api-errors.ts — rather than each route re-deriving
 * organizationId from a possibly-null session by hand.
 */
export async function requireSession(): Promise<Session & { user: NonNullable<Session['user']> }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  return session as Session & { user: NonNullable<Session['user']> };
}

/**
 * specs/01-data-model-and-auth.md "Roles": admin (full access), editor (create/edit
 * forms, view submissions), viewer (view submissions only) — "enforced in API route
 * handlers, not just UI hiding". Call after requireSession() in any route that mutates
 * forms/submissions; read-only routes generally don't need this since all three roles
 * can view.
 */
export function requireRole(session: Session, allowed: readonly UserRole[]): void {
  if (!allowed.includes(session.user.role)) {
    throw new ForbiddenError(`Requires role: ${allowed.join(' or ')}`);
  }
}
