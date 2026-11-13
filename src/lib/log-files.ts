import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';

// Daily log files for the application logger (src/lib/log.ts). Each stream appends to
//   <dir>/<YYYY-MM-DD>.clickforms.<kind>.log
// and starts a new file when the calendar day changes (in LOG_TIMEZONE), so no single file
// grows without end:
//   2026-11-13.clickforms.verbose.log   every log line (debug and up)
//   2026-11-13.clickforms.error.log     errors only, for a quick "what went wrong today"

export type LogFileKind = 'verbose' | 'error';

const LOG_TIMEZONE = process.env.LOG_TIMEZONE || 'Australia/Sydney';

/** YYYY-MM-DD for "today" in the log timezone, so one file covers one local calendar day. */
export function currentLogDay(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: LOG_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function logFileName(day: string, kind: LogFileKind): string {
  return `${day}.clickforms.${kind}.log`;
}

/** A write target pino can use directly. Never throws: if the file can't be written (disk
 * full, missing mount, permissions) it reports once on stderr and goes quiet, because a
 * logging problem must never take a request down with it. */
export class DailyFileStream {
  private stream: WriteStream | null = null;
  private day = '';
  private failed = false;

  private readonly dir: string;
  private readonly kind: LogFileKind;

  constructor(dir: string, kind: LogFileKind) {
    this.dir = dir;
    this.kind = kind;
  }

  write(line: string): void {
    if (this.failed) return;
    const day = currentLogDay();
    if (!this.stream || day !== this.day) this.open(day);
    this.stream?.write(line);
  }

  private open(day: string): void {
    this.stream?.end();
    this.day = day;
    try {
      mkdirSync(this.dir, { recursive: true });
      const stream = createWriteStream(join(this.dir, logFileName(day, this.kind)), { flags: 'a' });
      stream.on('error', (error) => this.fail(error));
      this.stream = stream;
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    if (this.failed) return;
    this.failed = true;
    this.stream = null;
    process.stderr.write(
      `${JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        event: 'logging.file_write_failed',
        kind: this.kind,
        dir: this.dir,
        error: error instanceof Error ? error.message : String(error),
      })}\n`,
    );
  }
}
