import 'server-only';

import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';

// Fixed-window rate limiter backed by Postgres (the rate_limits table), so a limit holds across
// every app instance and survives restarts and deploys. One atomic upsert per check: the row's
// counter is incremented, or reset when its window has expired, and the new count comes back.

/** True when this key has gone over `limit` hits inside the current window. Fails open: if the
 * database can't be reached the request is allowed (and the failure logged) rather than
 * locking everyone out of signup. */
export async function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const hashedKey = createHash('sha256').update(key).digest('hex');
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits (key, window_start, count)
      VALUES (${hashedKey}, now(), 1)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
            THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
            THEN now()
          ELSE rate_limits.window_start
        END
      RETURNING count`;

    // Occasional housekeeping so abandoned keys don't pile up.
    if (Math.random() < 0.02) {
      void prisma.$executeRaw`
        DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`.catch(() => {});
    }

    return (rows[0]?.count ?? 0) > limit;
  } catch (error) {
    log.error('rate_limit.check_failed', { error });
    return false;
  }
}

/** Best-effort client address behind the reverse proxy (Caddy sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
