import pino, { type Logger as PinoLogger, type StreamEntry } from 'pino';
import { DailyFileStream } from '@/lib/log-files';

// Application logging. One structured JSON line per event, written by pino to:
//   - stdout (so `docker logs` and any future log shipper see everything), and
//   - when LOG_DIR is set (the servers: /srv/logs), two daily files, see src/lib/log-files.ts:
//       <date>.clickforms.verbose.log  everything
//       <date>.clickforms.error.log    errors only
//
// Use it like this, anywhere on the server:
//   log.info('prefill.sent', { prefillId, formId });
//   log.error('pdf.render_failed', { submissionId, error });
//
// Conventions (keep them, they are what makes the logs searchable):
//   - The first argument is a stable event name, "area.what_happened", never a sentence with
//     values baked in. Values go in the fields object.
//   - Pass errors as `error`; they are flattened to name/message/stack.
//   - Never build a string containing a secret. Fields whose NAME looks sensitive (password,
//     token, secret, key, cookie, code…) are masked automatically at any depth, but a secret
//     pasted into a message string cannot be detected.
//   - Levels: debug = developer detail, off in production by default; info = something
//     happened; warn = unexpected but handled; error = something failed and needs a look.
//     LOG_LEVEL overrides the default.
//
// Do not use console.* in server code. Anything that still reaches the console (Next.js
// itself, third-party libraries) is routed into this logger by src/instrumentation.ts.

export const REDACTED = '***********';

const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|authorization|api[-_]?key|cookie|credential|code[-_]?hash|^code$|^otp$|signature[-_]?data/i;

const MAX_STRING = 500;
const MAX_DEPTH = 5;

/** Returns a copy of `value` that is safe to log: sensitive keys masked, long strings cut,
 * errors flattened, depth limited. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Data URLs (signatures, images) are never useful in a log line.
    if (value.startsWith('data:')) return '[data url]';
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    const extra = value as Error & { code?: unknown; status?: unknown; cause?: unknown };
    return {
      name: value.name,
      message: value.message,
      ...(extra.code !== undefined ? { code: extra.code } : {}),
      ...(extra.status !== undefined ? { status: extra.status } : {}),
      stack: value.stack?.split('\n').slice(0, 8).join('\n'),
      ...(extra.cause !== undefined && depth < MAX_DEPTH
        ? { cause: redact(extra.cause, depth + 1) }
        : {}),
    };
  }
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(child, depth + 1);
  }
  return out;
}

type Fields = Record<string, unknown>;

export interface AppLogger {
  debug(event: string, fields?: Fields): void;
  info(event: string, fields?: Fields): void;
  warn(event: string, fields?: Fields): void;
  error(event: string, fields?: Fields): void;
  /** A logger that adds the same fields to every line, e.g. log.child({ submissionId }). */
  child(bindings: Fields): AppLogger;
}

function createRoot(): PinoLogger {
  const production = process.env.NODE_ENV === 'production';
  const level = process.env.LOG_LEVEL || (production ? 'info' : 'debug');

  const streams: StreamEntry[] = [{ level: 'trace', stream: process.stdout }];
  const dir = process.env.LOG_DIR;
  if (dir) {
    streams.push({ level: 'trace', stream: new DailyFileStream(dir, 'verbose') });
    streams.push({ level: 'error', stream: new DailyFileStream(dir, 'error') });
  }

  return pino(
    {
      level,
      // The event name is the "message"; the field is called `event` in every line.
      messageKey: 'event',
      timestamp: () => `,"ts":"${new Date().toISOString()}"`,
      formatters: { level: (label) => ({ level: label }) },
      base: {
        service: 'clickforms',
        env: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
        ...(process.env.APP_VERSION ? { version: process.env.APP_VERSION } : {}),
      },
    },
    pino.multistream(streams),
  );
}

// One logger per process, including across dev hot reloads (which re-evaluate this module).
const globalStore = globalThis as typeof globalThis & { __clickformsLogger?: PinoLogger };
const root: PinoLogger = globalStore.__clickformsLogger ?? createRoot();
globalStore.__clickformsLogger = root;

function wrap(target: PinoLogger): AppLogger {
  const emit =
    (level: 'debug' | 'info' | 'warn' | 'error') =>
    (event: string, fields?: Fields): void => {
      try {
        target[level]((redact(fields ?? {}) as Fields) ?? {}, event);
      } catch {
        // Logging must never throw into the caller.
      }
    };
  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    child: (bindings) => wrap(target.child(redact(bindings) as Fields)),
  };
}

export const log: AppLogger = wrap(root);
