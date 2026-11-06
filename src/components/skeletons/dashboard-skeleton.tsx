import { range, Sk, SkRegion } from './primitives';

/** Mirrors DashboardClient: green hero (copy + snapshot widget) and the Recent Forms list. */
export function DashboardSkeleton() {
  return (
    <SkRegion label="Loading dashboard…">
      <div className="dashboard">
        <section className="dashboard-hero">
          <div className="dashboard-hero-grid">
            <div className="dashboard-hero-copy">
              <p className="dashboard-hero-kicker">
                <Sk w="7.5rem" h="0.8rem" className="sk--tint" inline />
              </p>
              <h2 className="dashboard-hero-title">
                <Sk w="min(18rem, 80%)" h="2.4rem" r="0.5rem" className="sk--tint" />
              </h2>
              <p className="dashboard-hero-lead">
                <Sk w="100%" h="0.8rem" className="sk--tint" />
                <Sk w="70%" h="0.8rem" className="sk--tint" style={{ marginTop: '0.55rem' }} />
              </p>
              <div className="dashboard-hero-actions">
                <Sk w="6.5rem" h="2.5rem" r="0.6rem" className="sk--tint" />
                <Sk w="7.5rem" h="2.5rem" r="0.6rem" className="sk--tint" />
              </div>
            </div>

            <div className="dashboard-hero-widget">
              <div className="dashboard-hero-widget-top">
                <Sk w="1.1rem" h="1.1rem" r="circle" inline />
                <Sk w="7rem" h="0.8rem" inline />
              </div>
              <ul className="dashboard-hero-widget-list">
                {range(3).map((row) => (
                  <li key={row}>
                    <span className="dashboard-hero-widget-row-label">
                      <Sk w="1rem" h="1rem" r="circle" inline />
                      <Sk w={`${5 + row}rem`} h="0.75rem" inline />
                    </span>
                    <Sk w="2.25rem" h="1.4rem" r="pill" inline />
                  </li>
                ))}
              </ul>
              <div className="dashboard-hero-widget-cta">
                <Sk w="6rem" h="0.8rem" inline />
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-recent-panel">
          <div className="dashboard-recent-panel-header">
            <Sk w="7rem" h="1rem" />
            <Sk w="4rem" h="0.8rem" />
          </div>
          <ul className="dashboard-recent-cards">
            {range(4).map((row) => (
              <li key={row}>
                <div className="dashboard-recent-card">
                  <div className="dashboard-recent-copy">
                    <Sk w={`${9 + ((row * 3) % 5)}rem`} h="0.9rem" />
                    <Sk w="4.5rem" h="0.65rem" style={{ marginTop: '0.4rem' }} />
                  </div>
                  <Sk w="5rem" h="0.75rem" />
                  <div className="dashboard-recent-end">
                    <Sk w="4.25rem" h="1.4rem" r="pill" />
                    <Sk w="1rem" h="1rem" r="circle" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SkRegion>
  );
}
