import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// specs/00-infrastructure.md acceptance criteria: the health endpoint must actually
// query the database, not just return a static 200 — proving the app-to-DB path works
// end-to-end, not just that the Next.js process is up.
export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('[health] database check failed:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
