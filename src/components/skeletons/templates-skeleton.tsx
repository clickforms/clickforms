import { range, Sk, SkRegion } from './primitives';

const FACETS = ['Sort by', 'Form layout', 'Industry'];

/** Mirrors the templates gallery: back/close, header, facet sidebar + types tree, search and
 * the card grid (static "Start from scratch" card renders for real). */
export function TemplatesSkeleton() {
  return (
    <SkRegion label="Loading templates…">
      <div className="template-gallery-page">
        <span className="template-gallery-back">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3.5 5.5 8l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </span>
        <span className="template-gallery-close" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <header className="template-gallery-header">
          <h1 className="template-gallery-title">Choose a template</h1>
          <p className="template-gallery-lead">
            Explore ready-made templates to create a form in minutes or{' '}
            <span className="template-gallery-scratch">create form from scratch</span>
          </p>
        </header>

        <div className="template-gallery-shell">
          <aside className="template-gallery-sidebar">
            {FACETS.map((label) => (
              <div className="template-gallery-select" key={label}>
                <span className="template-gallery-select-label">{label}</span>
                <div className="template-gallery-select-value">
                  <Sk w="4.5rem" h="0.8rem" />
                </div>
              </div>
            ))}
            <div className="template-gallery-types">
              <div className="template-gallery-types-header">
                <span>Types</span>
              </div>
              <ul className="template-gallery-types-list">
                {range(7).map((row) => (
                  <li key={row}>
                    <div className="template-gallery-type-row">
                      <Sk w={`${5 + ((row * 2) % 4)}rem`} h="0.8rem" />
                      <Sk w="1.1rem" h="0.8rem" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="template-gallery-main">
            <div className="template-gallery-search">
              <Sk w="100%" h="2.75rem" r="999px" />
            </div>
            <div className="template-gallery-grid">
              <div className="template-browse-card template-browse-card--scratch">
                <span className="template-browse-card-scratch-art" aria-hidden="true">
                  <span className="template-browse-card-scratch-plus">+</span>
                </span>
                <span className="template-browse-card-title">Start from scratch</span>
                <span className="template-browse-card-meta">A blank form, ready to design</span>
                <span className="template-browse-card-cta">Start blank</span>
              </div>
              {range(8).map((card) => (
                <div className="template-browse-card" key={card}>
                  <div className="template-browse-card-art">
                    <Sk w="100%" h="100%" r="0.5rem" />
                  </div>
                  <h2 className="template-browse-card-title">
                    <Sk w={`${55 + ((card * 7) % 30)}%`} h="1rem" />
                  </h2>
                  <p className="template-browse-card-meta">
                    <Sk w="70%" h="0.7rem" />
                  </p>
                  <Sk w="100%" h="2.4rem" r="0.6rem" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SkRegion>
  );
}
