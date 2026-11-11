import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';
import { preferenceKeySchema, preferenceValueSchema } from '@/lib/user-preferences';

const putBodySchema = z.object({ key: preferenceKeySchema, value: preferenceValueSchema });

/** GET /api/me/preferences?key=… — the signed-in user's saved preference, or { value: null }. */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const parsedKey = preferenceKeySchema.safeParse(new URL(request.url).searchParams.get('key'));
    if (!parsedKey.success) {
      throw new InvalidRequestError('Unknown preference key.');
    }
    const row = await prisma.userPreference.findUnique({
      where: { userId_key: { userId: session.user.id, key: parsedKey.data } },
      select: { value: true },
    });
    return NextResponse.json({ value: row?.value ?? null });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PUT /api/me/preferences — upsert one preference for the signed-in user. */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const body = putBodySchema.parse(await request.json());
    await prisma.userPreference.upsert({
      where: { userId_key: { userId: session.user.id, key: body.key } },
      create: { userId: session.user.id, key: body.key, value: body.value as object },
      update: { value: body.value as object },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
