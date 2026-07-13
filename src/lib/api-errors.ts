import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError, UnauthorizedError } from '@/lib/session';

/** Thrown by route handlers for a resource that doesn't exist (or isn't in this org's data). */
export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = 'NotFoundError';
  }
}

/** Thrown for a request that's well-formed JSON but violates a business rule (not a Zod shape error). */
export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequestError';
  }
}

/**
 * Every admin API route (specs/02-form-builder.md onward) wraps its body in try/catch
 * and calls this in the catch block — one place decides which error classes map to
 * which HTTP status, so a route can't accidentally leak a 500 for what's really a 401
 * or a validation problem.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof InvalidRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: error.issues },
      { status: 400 },
    );
  }

  console.error('[api] unhandled error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
