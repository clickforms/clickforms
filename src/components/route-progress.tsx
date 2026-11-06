'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import './route-progress.css';

// Top-of-page loading bar for client-side navigations. The App Router has no router events,
// so this watches the one thing every navigation has in common: it fetches the next page's
// React Server Component payload (`RSC: 1` header) from the server. The bar starts when such
// a request begins and finishes when it settles or the URL changes. Prefetches (which are
// invisible to the user) and server actions are ignored.

const SHOW_DELAY_MS = 120; // navigations that finish faster than this never flash the bar
const TRICKLE_MS = 200;

/** True for a user-visible page navigation (or router.refresh) fetch, false for prefetches. */
export function isNavigationRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(
    init?.headers ??
      (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined),
  );
  if (headers.get('RSC') !== '1') return false;
  if (headers.has('Next-Router-Prefetch') || headers.has('Next-Router-Segment-Prefetch')) {
    return false;
  }
  return true;
}

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams.toString()}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(0);
  const progress = useRef(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controls = useRef<{ start: () => void; finish: () => void } | null>(null);

  useEffect(() => {
    function render(next: number) {
      progress.current = next;
      if (barRef.current) barRef.current.style.width = `${next}%`;
    }

    function clearTimers() {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (trickleTimer.current) clearInterval(trickleTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      showTimer.current = trickleTimer.current = hideTimer.current = null;
    }

    function start() {
      inFlight.current += 1;
      if (inFlight.current > 1 || showTimer.current || trickleTimer.current) return;
      clearTimers();
      showTimer.current = setTimeout(() => {
        showTimer.current = null;
        rootRef.current?.classList.add('route-progress--active');
        render(8);
        trickleTimer.current = setInterval(() => {
          // Eases toward 90% and never reaches it, so it always looks like it is still going.
          render(progress.current + (90 - progress.current) * 0.08);
        }, TRICKLE_MS);
      }, SHOW_DELAY_MS);
    }

    function finish() {
      inFlight.current = Math.max(0, inFlight.current - 1);
      if (inFlight.current > 0) return;
      const wasShown = trickleTimer.current !== null;
      clearTimers();
      if (!wasShown) return; // finished before it ever appeared
      render(100);
      hideTimer.current = setTimeout(() => {
        rootRef.current?.classList.remove('route-progress--active');
        hideTimer.current = setTimeout(() => render(0), 260);
      }, 180);
    }

    controls.current = { start, finish };

    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(input, init) {
      if (!isNavigationRequest(input, init)) return originalFetch.call(this, input, init);
      start();
      return originalFetch.call(this, input, init).finally(finish);
    };

    return () => {
      window.fetch = originalFetch;
      clearTimers();
      controls.current = null;
      inFlight.current = 0;
    };
  }, []);

  // The URL changing means the new page has been committed — make sure the bar completes
  // even if the request bookkeeping above ended up out of step.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `url` is the trigger, not a value used inside
  useEffect(() => {
    if (inFlight.current > 0) {
      inFlight.current = 1;
      controls.current?.finish();
    }
  }, [url]);

  return (
    <div ref={rootRef} className="route-progress" role="progressbar" aria-hidden="true">
      <div ref={barRef} className="route-progress-bar" />
    </div>
  );
}
