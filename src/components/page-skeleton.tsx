// Instant placeholder shown by the route-level loading.tsx files while a page's server
// data loads. Without one, a navigation shows the old page frozen until the new one is fully
// rendered, which reads as the site hanging.
export function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-live="polite">
      <span className="page-skeleton-sr">Loading…</span>
      <div className="page-skeleton-bar page-skeleton-bar--title" />
      <div className="page-skeleton-bar page-skeleton-bar--sub" />
      <div className="page-skeleton-block" />
      <div className="page-skeleton-block" />
      <div className="page-skeleton-block page-skeleton-block--short" />
    </div>
  );
}
