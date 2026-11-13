import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import { format } from 'node:util';

// Daily log files. When LOG_DIR is set (it is on the servers: /srv/logs, see
// docker-compose.yml), everything the app writes to the console is also appended to
//   <LOG_DIR>/clickforms-YYYY-MM-DD.log
// with a new file started each day, so no single file grows without end. The console output
// itself is unchanged, so `docker logs` keeps working. With LOG_DIR unset (local dev) this
// does nothing.
//
// One JSON object per line. Lines produced by src/lib/log.ts are already JSON and are written
// as they are (their sensitive fields are masked there); anything else (Next.js's own output,
// stray console calls) is wrapped as {"ts","level","event":"console","message"}.

const LOG_TIMEZONE = process.env.LOG_TIMEZONE || 'Australia/Sydney';

let installed = false;

/** YYYY-MM-DD for "today" in the log timezone, so a file covers one local calendar day. */
function currentDay(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: LOG_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function installFileLogging(): void {
  const dir = process.env.LOG_DIR;
  if (!dir || installed) return;
  installed = true;

  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    original.error(`[file-logging] cannot create ${dir}; file logging is off`, error);
    return;
  }

  let stream: WriteStream | null = null;
  let streamDay = '';
  let failed = false;

  function streamFor(day: string): WriteStream | null {
    if (failed) return null;
    if (stream && streamDay === day) return stream;
    // A new day (or first write): close yesterday's file and open today's.
    stream?.end();
    streamDay = day;
    stream = createWriteStream(join(dir as string, `clickforms-${day}.log`), { flags: 'a' });
    stream.on('error', (error) => {
      // Disk full, permissions, missing mount: stop trying rather than fail every request.
      if (!failed) {
        failed = true;
        original.error('[file-logging] write failed; file logging is off', error);
      }
    });
    return stream;
  }

  function write(level: 'info' | 'warn' | 'error', args: unknown[]): void {
    const target = streamFor(currentDay());
    if (!target) return;
    const text = format(...args);
    // Already a structured line from src/lib/log.ts: keep it exactly.
    const line =
      text.startsWith('{"ts":') && text.endsWith('}')
        ? text
        : JSON.stringify({
            ts: new Date().toISOString(),
            level,
            event: 'console',
            message: text.length > 4000 ? `${text.slice(0, 4000)}…` : text,
          });
    target.write(`${line}\n`);
  }

  console.log = (...args: unknown[]) => {
    original.log(...args);
    write('info', args);
  };
  console.info = (...args: unknown[]) => {
    original.info(...args);
    write('info', args);
  };
  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    write('warn', args);
  };
  console.error = (...args: unknown[]) => {
    original.error(...args);
    write('error', args);
  };

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      event: 'logging.file_enabled',
      dir,
      timezone: LOG_TIMEZONE,
    }),
  );
}
