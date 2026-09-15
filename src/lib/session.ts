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

/**
 * Gate for the /admin (Clickforms platform-staff) area and its API routes. Deliberately
 * separate from requireRole() — `isPlatformAdmin` is a flag on the user (see
 * prisma/schema.prisma), not a value of the org-scoped `role` enum, since "admin of my
 * own org" and "Clickforms staff who can manage every org" are different axes of
 * authority that shouldn't be conflated.
 */
export function requirePlatformAdmin(session: Session): void {
  if (!session.user.isPlatformAdmin) {
    throw new ForbiddenError('Requires platform admin access');
  }
}

/** True for Clickforms staff who work in /admin and are not a member of any organisation. */
export function isPlatformOnlyAdmin(session: Session): boolean {
  return session.user.isPlatformAdmin && !session.user.organizationId;
}

/**
 * Narrows session.user.organizationId (string | null — see src/types/next-auth.d.ts;
 * null for platform-only admins with no org membership) to a plain string for the many
 * org-scoped routes/pages under /forms and /api that require org context to do anything
 * useful. Throws rather than letting `null` silently flow into a Prisma where/data
 * clause — every caller here is a route a platform-only admin shouldn't be able to
 * reach anyway (they have no org to scope to), so failing closed with a 403 is the
 * correct behavior, not just a type-checking workaround.
 */
export function requireOrganizationId(session: Session): string {
  if (!session.user.organizationId) {
    throw new ForbiddenError('This action requires an organisation-scoped session');
  }
  return session.user.organizationId;
}
