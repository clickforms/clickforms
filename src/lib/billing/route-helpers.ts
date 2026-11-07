import 'server-only';

import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-errors';
import type { AdminActor } from './admin';
import { BillingNotConfiguredError } from './stripe';

/** Error mapping shared by the billing routes: an unconfigured Stripe is a 503 with a clear
 * message rather than a generic 500. */
export function billingErrorResponse(error: unknown): NextResponse {
  if (error instanceof BillingNotConfiguredError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return toErrorResponse(error);
}

export function actorFrom(session: { user: { id: string; email?: string | null } }): AdminActor {
  return { id: session.user.id, email: session.user.email ?? 'unknown' };
}
