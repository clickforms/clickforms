import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

// next-auth v4's App Router integration: the handler is a single function that
// services both GET (CSRF token, session, provider metadata) and POST (sign in/out)
// requests under /api/auth/*.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
