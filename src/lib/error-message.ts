/** Normalize unknown thrown values into a user-facing message. */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return fallback;
}

/**
 * Read `{ error: string, issues?: { message?: string }[] }` from a parsed API response
 * body. Every route's catch block funnels a Zod validation failure through
 * toErrorResponse() (lib/api-errors.ts), which always sends the same generic
 * `error: 'Invalid request body'` alongside the real, field-specific `issues` array (e.g.
 * "ABN must be 11 digits") — so when `issues` is present, its first message is the one
 * worth showing the user; `error` there is just a category label, not real copy.
 */
export function extractApiError(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    if ('issues' in body && Array.isArray(body.issues)) {
      const firstIssue: unknown = body.issues[0];
      const issueMessage =
        firstIssue && typeof firstIssue === 'object' && 'message' in firstIssue
          ? (firstIssue as { message?: unknown }).message
          : undefined;
      if (typeof issueMessage === 'string' && issueMessage.trim()) {
        return issueMessage;
      }
    }
    if ('error' in body) {
      const message = (body as { error?: unknown }).error;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
  }
  return fallback;
}

/** Read `{ error: string }` from a failed API response body. */
export async function readApiError(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  return extractApiError(body, fallback);
}
