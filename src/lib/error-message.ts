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

/** Read `{ error: string }` from a parsed API response body. */
export function extractApiError(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const message = body.error;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
}

/** Read `{ error: string }` from a failed API response body. */
export async function readApiError(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  return extractApiError(body, fallback);
}
