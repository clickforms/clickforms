// Next.js calls register() once when the server process starts, and onRequestError() for
// every error thrown while handling a request (pages, route handlers, server actions).
// Both are used for logging only; see src/lib/log.ts.

export async function register(): Promise<void> {
  // The logger writes files, so it only exists in the Node.js runtime.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { installConsoleCapture, installProcessErrorLogging } = await import('@/lib/file-logging');
  installConsoleCapture();
  installProcessErrorLogging();
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { log } = await import('@/lib/log');
  log.error('request.unhandled_error', {
    method: request.method,
    // Path only: query strings can carry tokens (prefill links, reset links).
    path: request.path.split('?')[0],
    route: context.routePath,
    routeType: context.routeType,
    error: error instanceof Error ? error : new Error(String(error)),
  });
}
