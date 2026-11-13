import { format } from 'node:util';
import { log } from '@/lib/log';

// Routes anything that still writes to the console (Next.js's own output, third-party
// libraries, a stray console call) into the application logger, so it ends up as structured
// lines in the same places as everything else: stdout and the daily files. Application code
// itself should call `log` directly (see src/lib/log.ts).
//
// Only switched on where LOG_DIR is set (the servers). Local development keeps the normal,
// human-readable console.

let installed = false;

export function installConsoleCapture(): void {
  if (installed || !process.env.LOG_DIR) return;
  installed = true;

  const send =
    (level: 'info' | 'warn' | 'error') =>
    (...args: unknown[]): void => {
      const error = args.find((arg): arg is Error => arg instanceof Error);
      const message = format(...args.filter((arg) => !(arg instanceof Error))).trim();
      log[level]('console', {
        message: message.length > 4000 ? `${message.slice(0, 4000)}…` : message,
        ...(error ? { error } : {}),
      });
    };

  console.log = send('info');
  console.info = send('info');
  console.debug = send('info');
  console.warn = send('warn');
  console.error = send('error');

  log.info('logging.started', {
    dir: process.env.LOG_DIR,
    timezone: process.env.LOG_TIMEZONE || 'Australia/Sydney',
    level: process.env.LOG_LEVEL || 'info',
  });
}

/** Records crashes that would otherwise only appear as a raw stack trace (or not at all).
 * Observers only: they do not change how Node or Next.js react to the failure. */
export function installProcessErrorLogging(): void {
  const flag = globalThis as typeof globalThis & { __clickformsProcessLogging?: boolean };
  if (flag.__clickformsProcessLogging) return;
  flag.__clickformsProcessLogging = true;

  process.on('uncaughtExceptionMonitor', (error, origin) => {
    log.error('process.uncaught_exception', { origin, error });
  });
  process.on('unhandledRejection', (reason) => {
    log.error('process.unhandled_rejection', {
      error: reason instanceof Error ? reason : new Error(String(reason)),
    });
  });
}
