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
import { prisma } from '@/lib/db';

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
        const user = await prisma.user.findFirst({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user) {
          return null;
        }

        const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!passwordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.organizationId = user.organizationId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.organizationId = token.organizationId;
      session.user.role = token.role;
      return session;
    },
  },
  secret: process.env.SESSION_SECRET,
};
