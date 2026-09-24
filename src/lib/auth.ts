// Auth.js / NextAuth v4 (stable "next-auth" line, currently 4.24.14) is used here
// deliberately instead of v5 ("next-auth@beta" / the "auth" package). v5 has a more
// App-Router-idiomatic API — a single `auth()` helper usable in Server Components,
// middleware, and route handlers without the `getServerSession(authOptions)` dance
// below — but as of this writing v5 is still published under npm's `beta` dist-tag,
// not `latest`. "Safe, stable package versions" was an explicit requirement for this
// scaffold, so v4 wins the tradeoff even though v5 would read more idiomatically.
// When v5 ships stable: this file's `NextAuthOptions` object becomes the config passed
// to `NextAuth(authConfig)` in a single root `auth.ts`, and
// `src/app/api/auth/[...nextauth]/route.ts` collapses into `export { GET, POST } from
// '@/auth'`.

import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma, withOrgContext } from '@/lib/db';

/**
 * True only while `userId` has an active (leftAt: null) PlatformAdminOrgAccess row for
 * `organizationId` — i.e. they got there via "Join this organisation" (see
 * src/app/api/admin/organizations/[id]/join/route.ts), not because they're a genuine
 * org employee who also happens to have isPlatformAdmin = true. platform_admin_org_access
 * carries no RLS (see prisma/schema.prisma), so this is always a plain-client read.
 */
async function isTemporaryOrgJoin(userId: string, organizationId: string | null): Promise<boolean> {
  if (!organizationId) return false;
  const activeAccess = await prisma.platformAdminOrgAccess.findFirst({
    where: { userId, organizationId, leftAt: null },
    select: { id: true },
  });
  return activeAccess !== null;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    // Sessions are capped at 24 hours — NextAuth's default is 30 days, which is too
    // long for an internal admin tool. maxAge and updateAge are set equal so the JWT's
    // `exp` isn't silently pushed out by NextAuth's default rolling-session refresh:
    // once 24 hours have passed since sign-in, the token is expired and the user is
    // sent back to /login, regardless of how recently they were active.
    maxAge: 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Deliberate exception to the withOrgContext(...) rule in src/lib/db.ts:
        // organizationId isn't known until we've found the user, so this is the one
        // query in the app that runs directly against the top-level `prisma` client
        // rather than inside an RLS-scoped transaction. Every query downstream of a
        // successful login goes through withOrgContext using the session's
        // organizationId. Email lookup is intentionally not org-scoped since a user
        // signs in with just their email — org membership is a property of the user
        // row we're looking up, not an input to the lookup.
        const normalizedEmail = credentials.email.toLowerCase();

        // A single email can have one User row per organisation (see User's
        // @@unique([organizationId, email])) — e.g. someone who's a genuine member of
        // more than one org, or Clickforms staff who also run a pilot customer org under
        // the same address. This used to fetch a single arbitrary candidate (preferring
        // any isPlatformAdmin row, else whichever row the query happened to return first)
        // and check the typed password only against that one row. If two of a person's
        // accounts ever happened to share a password — trivially easy to do by accident,
        // e.g. reusing the same password when accepting a brand-new org's invite — login
        // would silently succeed against whichever row was fetched, signing the person
        // into a completely different organisation's account than the one whose
        // credentials they actually typed. Checking every row for this email individually
        // means we only ever return the row whose own password hash actually verifies.
        const candidates = await prisma.user.findMany({
          where: { email: normalizedEmail },
          include: { organization: { select: { status: true, trialEndsAt: true } } },
        });

        const verifiedCandidates: typeof candidates = [];
        for (const candidate of candidates) {
          if (await bcrypt.compare(credentials.password, candidate.passwordHash)) {
            verifiedCandidates.push(candidate);
          }
        }

        if (verifiedCandidates.length === 0) {
          return null;
        }

        // If the same password happens to verify for more than one of this email's
        // accounts, prefer a platform-admin match (keeps the existing "platform staff
        // sign in to /admin" precedence). Otherwise there's no way to tell which of
        // several genuinely distinct organisation accounts the person meant — fail closed
        // with a distinct error rather than guessing and landing them in the wrong org.
        const user =
          verifiedCandidates.find((candidate) => candidate.isPlatformAdmin) ??
          (verifiedCandidates.length === 1 ? verifiedCandidates[0] : undefined);

        if (!user) {
          throw new Error('AmbiguousAccount');
        }

        // A platform admin can suspend an organisation from /admin (reversible — see
        // OrgStatus doc comment in prisma/schema.prisma) without deleting any data.
        // Blocking sign-in here is the enforcement point; it deliberately does not
        // touch public /f/* form access, which is a separate scope decision.
        if (user.organization?.status === 'suspended') {
          throw new Error('OrganizationSuspended');
        }

        // Deliberately does NOT block sign-in when a trial has expired (unlike the
        // suspended check above) — an expired trial still lets people in so they can see
        // their data, read submissions, and find the upgrade path; it's write access and
        // public form availability that get cut off (see src/lib/admin/plan-limits.ts's
        // assertOrgActionsAllowed and src/lib/forms/public-lookup.ts), and the dashboard
        // shell (admin-shell-client.tsx) shows a persistent banner for it. Suspension is
        // different: a platform admin can suspend without leaving `status` clean data to
        // display, so locking that one out at sign-in is still the right call.

        return {
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          role: user.role,
          isPlatformAdmin: user.isPlatformAdmin,
          isTemporaryOrgJoin: await isTemporaryOrgJoin(user.id, user.organizationId),
        };
      },
    }),
  ],
  callbacks: {
    // `trigger: 'update'` fires when the client calls the `useSession().update()` hook
    // (see src/components/session-provider.tsx and its two call sites — joining/leaving
    // an organisation via /admin) — the JWT strategy otherwise only reads these fields
    // once at sign-in, so without this branch a platform admin who joins/leaves an org
    // wouldn't see it reflected until their 24h session expired and they signed in again.
    //
    // Deliberately re-reads from the database rather than trusting whatever the client
    // passed to update() — `session` here is client-supplied and MUST NOT be trusted for
    // authorization-relevant fields like organizationId/role, or a signed-in user could
    // self-escalate by calling update({ organizationId: '<any org>', role: 'admin' })
    // directly. The client is only allowed to pass `candidateOrganizationId`, a *hint*
    // used purely to satisfy the `users` table's RLS USING clause for this SELECT (see
    // the tenant_isolation / platform_admin_unscoped policies in
    // prisma/migrations/20260712000100_add_row_level_security and
    // 20260910000001_platform_admin_unscoped) — if the hint is wrong, or an attacker
    // supplies someone else's org id, the query just finds no row (RLS hides it) and the
    // token is left unchanged; the hint can never make the query return different field
    // *values* than what's actually in the actor's own row.
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.organizationId = user.organizationId;
        token.role = user.role;
        token.isPlatformAdmin = user.isPlatformAdmin;
        token.isTemporaryOrgJoin = user.isTemporaryOrgJoin;
        return token;
      }

      if (trigger === 'update' && token.userId) {
        const candidateOrganizationId =
          session && typeof session === 'object' && 'candidateOrganizationId' in session
            ? ((session as { candidateOrganizationId?: unknown }).candidateOrganizationId ?? null)
            : null;

        const freshUser =
          typeof candidateOrganizationId === 'string'
            ? await withOrgContext(candidateOrganizationId, (tx) =>
                tx.user.findUnique({
                  where: { id: token.userId },
                  select: { organizationId: true, role: true, isPlatformAdmin: true },
                }),
              )
            : await prisma.user.findUnique({
                where: { id: token.userId },
                select: { organizationId: true, role: true, isPlatformAdmin: true },
              });

        if (freshUser) {
          token.organizationId = freshUser.organizationId;
          token.role = freshUser.role;
          token.isPlatformAdmin = freshUser.isPlatformAdmin;
          token.isTemporaryOrgJoin = await isTemporaryOrgJoin(
            token.userId,
            freshUser.organizationId,
          );
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.organizationId = token.organizationId;
      session.user.role = token.role;
      session.user.isPlatformAdmin = token.isPlatformAdmin;
      session.user.isTemporaryOrgJoin = token.isTemporaryOrgJoin;
      return session;
    },
  },
  secret: process.env.SESSION_SECRET,
};
