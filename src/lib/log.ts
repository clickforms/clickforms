// Structured application logging: one JSON object per line on stdout/stderr, so `docker logs`
// (and any log shipper) can read and filter it. Sensitive values are masked before anything is
// written: any field whose name looks like a password, token, secret, key, cookie or code is
// replaced with "***********", at any depth.

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
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.split('\n').slice(0, 6).join('\n'),
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

type Level = 'info' | 'warn' | 'error';

function write(level: Level, event: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...((redact(fields ?? {}) as Record<string, unknown>) ?? {}),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write('error', event, fields),
};
