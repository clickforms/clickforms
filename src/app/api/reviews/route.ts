import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import { prisma } from '@/lib/db';
import { getRequestIp } from '@/lib/forms/public-lookup';
import { reviewInputSchema } from '@/lib/reviews/schema';

// Public, unauthenticated: anyone with the /review link can send a review. Abuse controls are
// a honeypot field, strict validation and a small per-IP hourly cap (a salted hash of the IP
// is stored only for that cap). Reviews land as `pending` and nothing is shown anywhere until
// a platform admin approves it.
const REVIEWS_PER_IP_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;

function hashIp(ip: string): string {
  return createHash('sha256')
    .update(`${process.env.NEXTAUTH_SECRET ?? ''}:${ip}`)
    .digest('hex');
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => null);
    const raw = (body ?? {}) as Record<string, unknown>;

    // A filled honeypot looks like success to the bot but stores nothing.
    if (typeof raw.website === 'string' && raw.website.length > 0) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const input = reviewInputSchema.parse(body);

    const ip = getRequestIp(request);
    const ipHash = ip ? hashIp(ip) : null;
    if (ipHash) {
      const recent = await prisma.review.count({
        where: { ipHash, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
      });
      if (recent >= REVIEWS_PER_IP_PER_HOUR) {
        return NextResponse.json(
          { error: 'Thanks for the enthusiasm. Please try again a little later.' },
          { status: 429 },
        );
      }
    }

    await prisma.review.create({
      data: {
        name: input.name,
        company: input.company,
        body: input.body,
        role: input.role ?? null,
        rating: input.rating ?? null,
        email: input.email ?? null,
        consentToPublish: true,
        ipHash,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
