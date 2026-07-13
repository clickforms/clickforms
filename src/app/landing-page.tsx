import Link from 'next/link';
import type { CSSProperties } from 'react';
import { BrandMark } from '@/components/brand-mark';

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3.5 9h11M10 5l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BuilderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect
        x="12.5"
        y="3.5"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="3.5"
        y="12.5"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="12.5"
        y="12.5"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CollectIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 3v12M6 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 17h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="5" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.3 10.2 14.5 6.2M7.3 11.8l7.2 4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 3 17 5.5V10.5c0 3.5-2.5 6-6 7.5-3.5-1.5-6-4-6-7.5V5.5L11 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 11 10.5 13 14 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FIELD_TYPES = [
  'Short text',
  'Long text',
  'Dropdown',
  'Checkbox',
  'Date',
  'File upload',
  'Signature',
  'Section break',
  'Static text',
  'Multi choice',
] as const;

const FEATURES = [
  {
    icon: BuilderIcon,
    title: 'Drag-and-drop builder',
    desc: '15+ field types, multi-page layouts, conditional logic, and custom branding — design forms that match your process.',
  },
  {
    icon: CollectIcon,
    title: 'Collect accurately',
    desc: 'Validation, file uploads, e-signatures, and structured answers for intake and consent.',
  },
  {
    icon: WorkflowIcon,
    title: 'Approval workflow',
    desc: 'Draft, submit for review, approve, and publish — full lifecycle control for every form.',
  },
  {
    icon: ShieldIcon,
    title: 'Secure by default',
    desc: 'Authenticated admin access, audit trails, and data that stays under your control.',
  },
] as const;

const TEMPLATES = [
  {
    tag: 'Healthcare',
    title: 'Client intake',
    desc: 'Collect demographics, referrals, and consent in one flow.',
    accent: '#3a9e8f',
  },
  {
    tag: 'Compliance',
    title: 'Service agreement',
    desc: 'Multi-page agreements with e-signatures and file uploads.',
    accent: '#4a90c4',
  },
  {
    tag: 'Operations',
    title: 'Incident report',
    desc: 'Structured reporting with conditional follow-up fields.',
    accent: '#7b6fc4',
  },
  {
    tag: 'Admin',
    title: 'Support plan',
    desc: 'Goals, outcomes, and review dates on a branded form.',
    accent: '#00a960',
  },
] as const;

export function LandingPage({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const primaryHref = isAuthenticated ? '/forms' : '/login';
  const primaryLabel = isAuthenticated ? 'Go to portal' : 'Sign in to admin';

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-brand">
            <BrandMark id="nav" />
            <span>Clickforms</span>
          </Link>
          <nav className="landing-nav-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#templates">Use cases</a>
            <a href="#how-it-works">How it works</a>
          </nav>
          <div className="landing-nav-actions">
            {isAuthenticated ? (
              <Link className="landing-btn landing-btn--primary landing-btn--sm" href="/forms">
                Go to portal
              </Link>
            ) : (
              <>
                <Link className="landing-link-btn" href="/signup">
                  Sign up
                </Link>
                <Link className="landing-btn landing-btn--primary landing-btn--sm" href="/login">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-container landing-hero-inner">
          <div className="landing-hero-copy">
            <p className="landing-kicker-hero">Clickforms platform</p>
            <h1 className="landing-hero-title">
              Forms that move
              <span className="landing-hero-accent"> as fast as your team</span>
            </h1>
            <p className="landing-hero-lead">
              Build intake, consent, and service agreement forms. Collect signatures, route
              approvals, and review submissions — your in-house replacement for scattered form
              workflows.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-btn landing-btn--primary landing-btn--lg" href={primaryHref}>
                {primaryLabel}
                <ArrowRightIcon />
              </Link>
              <a className="landing-btn landing-btn--ghost landing-btn--lg" href="#features">
                Explore features
              </a>
            </div>
            <div className="landing-hero-metrics">
              <div className="landing-metric">
                <strong>15+</strong>
                <span>field types</span>
              </div>
              <div className="landing-metric-divider" />
              <div className="landing-metric">
                <strong>E-sign</strong>
                <span>built in</span>
              </div>
              <div className="landing-metric-divider" />
              <div className="landing-metric">
                <strong>Multi-page</strong>
                <span>forms</span>
              </div>
            </div>
          </div>

          <div className="landing-hero-stage" aria-hidden="true">
            <div className="landing-mock landing-mock--builder">
              <div className="landing-mock-bar">
                <span className="landing-mock-dot landing-mock-dot--r" />
                <span className="landing-mock-dot landing-mock-dot--y" />
                <span className="landing-mock-dot landing-mock-dot--g" />
                <span className="landing-mock-bar-title">Consent form · Builder</span>
              </div>
              <div className="landing-mock-builder-body">
                <div className="landing-mock-palette">
                  <small>Fields</small>
                  <div className="landing-mock-chip">Text</div>
                  <div className="landing-mock-chip landing-mock-chip--on">Signature</div>
                  <div className="landing-mock-chip">Upload</div>
                  <div className="landing-mock-chip">Date</div>
                </div>
                <div className="landing-mock-canvas">
                  <div className="landing-mock-banner">Participant details</div>
                  <div className="landing-mock-input-row">
                    <div className="landing-mock-field">
                      <span className="landing-mock-field-label">Full name</span>
                      <div className="landing-mock-input landing-mock-input--filled" />
                    </div>
                  </div>
                  <div className="landing-mock-input-row landing-mock-input-row--2">
                    <div className="landing-mock-field">
                      <span className="landing-mock-field-label">Email</span>
                      <div className="landing-mock-input landing-mock-input--filled" />
                    </div>
                    <div className="landing-mock-field">
                      <span className="landing-mock-field-label">Phone</span>
                      <div className="landing-mock-input" />
                    </div>
                  </div>
                  <div className="landing-mock-banner landing-mock-banner--sig">Consent</div>
                  <div className="landing-mock-sig">
                    <svg viewBox="0 0 140 44" aria-hidden="true">
                      <path
                        d="M6 30 C 24 6, 42 42, 58 20 S 88 4, 118 28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="landing-container">
          <div className="landing-field-strip">
            <p className="landing-field-strip-label">Field types included</p>
            <div className="landing-field-strip-list">
              {FIELD_TYPES.map((field) => (
                <span key={field}>{field}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head--center">
            <p className="landing-kicker">Platform</p>
            <h2 className="landing-h2">
              Build. Collect. Approve.
              <br />
              <span className="landing-h2-muted">All in one place.</span>
            </h2>
          </div>

          <div className="landing-features">
            {FEATURES.map((f) => (
              <article key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon">
                  <f.icon />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>

          <div className="landing-panels">
            <article className="landing-panel">
              <div className="landing-panel-copy">
                <h3>See the builder in action</h3>
                <p>Drag fields onto the canvas, arrange pages, and preview as you go.</p>
              </div>
              <div className="landing-panel-visual">
                <div className="landing-mini-builder">
                  <div className="landing-mini-palette">
                    {['Text', 'Choice', 'Sign', 'File'].map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </div>
                  <div className="landing-mini-canvas">
                    <div className="landing-mini-bar" />
                    <div className="landing-mini-lines">
                      <div />
                      <div />
                      <div className="landing-mini-lines--half" />
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="landing-panel">
              <div className="landing-panel-copy">
                <h3>Review every submission</h3>
                <p>Search, filter, and inspect responses from a central admin workspace.</p>
              </div>
              <div className="landing-panel-visual">
                <div className="landing-mini-table">
                  <div className="landing-mini-table-head">
                    <span>Form</span>
                    <span>Submitted</span>
                    <span>Status</span>
                  </div>
                  <div className="landing-mini-table-row">
                    <span>Client intake</span>
                    <span>Today, 9:14</span>
                    <span className="landing-mini-pill landing-mini-pill--green">Complete</span>
                  </div>
                  <div className="landing-mini-table-row">
                    <span>Consent form</span>
                    <span>Today, 8:02</span>
                    <span className="landing-mini-pill landing-mini-pill--green">Complete</span>
                  </div>
                  <div className="landing-mini-table-row">
                    <span>Incident report</span>
                    <span>Yesterday</span>
                    <span className="landing-mini-pill landing-mini-pill--amber">Review</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--alt" id="templates">
        <div className="landing-container">
          <div className="landing-section-head">
            <p className="landing-kicker">Use cases</p>
            <h2 className="landing-h2">Built for the forms you run every day</h2>
            <p className="landing-section-lead">
              From client onboarding to incident reporting — templates and workflows your team
              already knows.
            </p>
          </div>
          <div className="landing-template-grid">
            {TEMPLATES.map((t) => (
              <article
                key={t.title}
                className="landing-template-card"
                style={{ '--tpl-accent': t.accent } as CSSProperties}
              >
                <span className="landing-template-tag">{t.tag}</span>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head--center">
            <p className="landing-kicker">How it works</p>
            <h2 className="landing-h2">Live in three steps</h2>
          </div>
          <ol className="landing-timeline">
            <li className="landing-timeline-step">
              <div className="landing-timeline-marker">1</div>
              <div className="landing-timeline-body">
                <h3>Design</h3>
                <p>
                  Start from a template or blank canvas. Add fields, pages, logic, and brand
                  colours.
                </p>
              </div>
            </li>
            <li className="landing-timeline-step">
              <div className="landing-timeline-marker">2</div>
              <div className="landing-timeline-body">
                <h3>Approve & publish</h3>
                <p>
                  Submit for review, publish when ready, and share a secure link with clients or
                  staff.
                </p>
              </div>
            </li>
            <li className="landing-timeline-step">
              <div className="landing-timeline-marker">3</div>
              <div className="landing-timeline-body">
                <h3>Collect & review</h3>
                <p>
                  Submissions arrive instantly. Search, filter, and review from the admin workspace.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-container landing-cta-inner">
          <h2 className="landing-cta-title">Ready to modernise your form workflows?</h2>
          <p className="landing-cta-lead">
            {isAuthenticated
              ? 'Continue to your portal to build forms, review submissions, and manage workflows.'
              : "Sign in to build forms, review submissions, and manage your team's workflows."}
          </p>
          <Link className="landing-btn landing-btn--white landing-btn--lg" href={primaryHref}>
            {primaryLabel}
            <ArrowRightIcon />
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <Link href="/" className="landing-brand landing-brand--footer">
            <BrandMark size={24} id="footer" />
            <span>Clickforms</span>
          </Link>
          <p>Clickforms · Internal forms platform</p>
        </div>
      </footer>
    </div>
  );
}
