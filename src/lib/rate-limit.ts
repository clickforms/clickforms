// Small in-memory sliding-window limiter, keyed by an arbitrary string (usually a client IP).
// Per-process only: fine for one app container, and it still blunts scripted abuse of public
// endpoints. Swap for a shared store (Redis) if the app ever runs on several instances.

const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  // Opportunistic cleanup so the map can't grow without bound.
  if (hits.size > 5000) {
    for (const [mapKey, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(mapKey);
    }
  }
  return false;
}

/** Best-effort client address behind the reverse proxy (Caddy sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
