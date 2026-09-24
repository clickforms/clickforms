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

/** Thrown by src/lib/admin/plan-limits.ts's plan-enforcement helpers (assertCanCreateForm,
 * assertCanInviteUser, assertWithinStorageLimit, assertWithinSubmissionLimit) when an action
 * would push an organisation past its plan's cap (forms/users/storage/submissions — see
 * PLAN_LIMITS). Kept distinct from InvalidRequestError so callers can special-case "upgrade
 * to continue" messaging; mapped to 402 Payment Required, not 400, since the request itself
 * is well-formed and would succeed on a higher plan. */
export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanLimitError';
  }
}

/** Thrown by src/lib/admin/plan-limits.ts's assertOrgActionsAllowed when an organisation's
 * trial has ended — the gate on "platform actions" (creating/editing forms, inviting
 * users, uploading files, changing org settings). Distinct from PlanLimitError: this isn't
 * about which plan tier the org is on, it's about the org having no active plan or live
 * trial at all. Also mapped to 402, since — same as PlanLimitError — the request is
 * well-formed and would succeed once the org has a plan. */
export class TrialExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrialExpiredError';
  }
}

/** Thrown by src/lib/forms/public-lookup.ts's assertOrgAcceptingNewSubmissions when a
 * respondent tries to open or start filling in a form whose organisation's trial has
 * expired — the "live forms go offline" half of trial expiry (assertOrgActionsAllowed
 * above is the other half, for the org's own staff). Deliberately generic to the
 * respondent — no mention of trials or billing, just that the form isn't available right
 * now — and never thrown for a submission already in progress (see that function's doc
 * comment): an in-flight fill-out is allowed to finish, same as a form taken offline
 * manually mid-fill. */
export class FormOfflineError extends Error {
  constructor() {
    super('This form is not currently accepting responses.');
    this.name = 'FormOfflineError';
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
  if (error instanceof PlanLimitError) {
    return NextResponse.json({ error: error.message }, { status: 402 });
  }
  if (error instanceof TrialExpiredError) {
    return NextResponse.json({ error: error.message }, { status: 402 });
  }
  if (error instanceof FormOfflineError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? 'Invalid request body',
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  console.error('[api] unhandled error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
