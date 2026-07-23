import Link from 'next/link';
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

function LayoutIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8.5h16" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8.5V19" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7.5 11.2l2.3 2.3 4.7-5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StampIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 3.5c-2 0-3.4 1.5-3.4 3.3 0 1.6 1 2.4 1 3.7H6.8c-1 0-1.8.8-1.8 1.8v2.2h12.4v-2.2c0-1-.8-1.8-1.8-1.8h-1.9c0-1.3 1.1-2.1 1.1-3.7 0-1.8-1.5-3.3-3.4-3.3-.1 0-.3 0-.4.02.1-.02.2-.02.4-.02Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M4 18.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="9.75" cy="9.75" r="6.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14.5 14.5 19 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 2.75 18 5.5v5c0 5-3 8-7 9-4-1-7-4-7-9v-5l7-2.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 11l2.1 2.1L14.3 8.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="8.25" cy="7.5" r="2.75" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.25 17.5c0-2.9 2.24-5.25 5-5.25s5 2.35 5 5.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14 8.25a2.5 2.5 0 1 0 0-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15.75 12.5c2.15.4 3.75 2.3 3.75 4.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect
        x="4.5"
        y="10"
        width="13"
        height="8.5"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M7.25 10V7.25a3.75 3.75 0 0 1 7.5 0V10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M4.5 6.75 9 11.25l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CAPABILITIES = [
  {
    num: '01',
    icon: LayoutIcon,
    title: 'Design with precision',
    desc: 'Drag fields onto a live canvas. Multi-page layouts, conditional logic, and brand colours that match your organisation.',
  },
  {
    num: '02',
    icon: CheckCircleIcon,
    title: 'Collect complete answers',
    desc: 'Twenty-plus field types, validation, file uploads, and e-signatures so intake and consent arrive structured — not as scattered PDFs.',
  },
  {
    num: '03',
    icon: StampIcon,
    title: 'Approve before it goes live',
    desc: 'Draft, submit for review, approve, and publish. Every form has a clear lifecycle your team can trust.',
  },
  {
    num: '04',
    icon: SearchIcon,
    title: 'Review in one workspace',
    desc: 'Search, filter, and inspect submissions from a central admin portal — audit trails included.',
  },
] as const;

const STATS = [
  { value: '20+', label: 'Field types, from e-signatures to conditional logic' },
  { value: '100%', label: 'Submissions kept in a structured, exportable format' },
  { value: 'Unlimited', label: 'Pages, branches, and approval steps per form' },
  { value: 'Full', label: 'Audit trail on every form and every response' },
] as const;

const SECURITY_FEATURES = [
  {
    icon: ShieldIcon,
    title: 'Private by default, shared on purpose',
    desc: 'Every form can be scoped to its creator or opened to the whole organisation — never public by accident.',
  },
  {
    icon: UsersIcon,
    title: 'Role-based access',
    desc: 'Admins, editors, and reviewers see exactly what their role allows. Ownership transfers cleanly when people move on.',
  },
  {
    icon: SearchIcon,
    title: 'Full audit trail',
    desc: 'Every publish, approval, and edit is logged — so compliance reviews and incident follow-ups have a clear record.',
  },
  {
    icon: LockIcon,
    title: 'Secure storage for sensitive uploads',
    desc: 'Signatures, ID documents, and attachments are stored in access-controlled cloud storage, never in a shared inbox.',
  },
] as const;

const FAQS = [
  {
    q: 'Can I match Clickforms to our brand?',
    a: 'Yes. Set your primary colour, logo, and submit-button styling once in organisation settings, and every form your team publishes inherits it automatically.',
  },
  {
    q: 'Does it handle multi-page forms with branching logic?',
    a: 'Yes — build any number of pages, and show or hide individual fields or whole sections based on earlier answers, all without writing code.',
  },
  {
    q: 'Who can see a submitted form?',
    a: 'You choose. Forms default to visible across your organisation, or you can restrict a form to just its creator. Every view and edit is recorded in the audit trail.',
  },
  {
    q: 'Can we collect signatures and file uploads?',
    a: 'Yes — e-signature capture and file/image uploads (with size and type limits you control) are both built-in field types, alongside 20+ others.',
  },
  {
    q: 'What happens to a form before it goes live?',
    a: 'Forms move through a clear draft → review → published lifecycle, so nothing reaches respondents until your team has actually signed off on it.',
  },
] as const;

const USE_CASES = [
  {
    domain: 'Healthcare',
    title: 'Client intake',
    desc: 'Demographics, referrals, and consent in a single branded flow.',
  },
  {
    domain: 'Compliance',
    title: 'Service agreements',
    desc: 'Multi-page agreements with e-signatures and supporting uploads.',
  },
  {
    domain: 'Operations',
    title: 'Incident reports',
    desc: 'Structured reporting with conditional follow-up fields.',
  },
  {
    domain: 'Admin',
    title: 'Support plans',
    desc: 'Goals, outcomes, and review dates on a form your team owns.',
  },
] as const;

const STEPS = [
  {
    title: 'Design',
    desc: 'Start from a template or blank canvas. Add fields, pages, logic, and brand colours.',
  },
  {
    title: 'Approve & publish',
    desc: 'Submit for review, publish when ready, and share a secure link with clients or staff.',
  },
  {
    title: 'Collect & review',
    desc: 'Submissions arrive instantly. Search, filter, and review from the admin workspace.',
  },
] as const;

export function LandingPage({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const primaryHref = isAuthenticated ? '/forms' : '/login';
  const primaryLabel = isAuthenticated ? 'Go to portal' : 'Sign in to admin';
  const secondaryHref = isAuthenticated ? '/forms' : '/signup';
  const secondaryLabel = isAuthenticated ? 'Open workspace' : 'Create account';

  return (
    <div className="landing">
      <div className="landing-atmosphere" aria-hidden="true">
        <div className="landing-atmosphere-orb landing-atmosphere-orb--a" />
        <div className="landing-atmosphere-orb landing-atmosphere-orb--b" />
        <div className="landing-atmosphere-grid" />
      </div>

      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-brand">
            <BrandMark id="nav" />
            <span>Clickforms</span>
          </Link>
          <nav className="landing-nav-links" aria-label="Primary">
            <a href="#capabilities">Capabilities</a>
            <a href="#product">Product</a>
            <a href="#security">Security</a>
            <a href="#faq">FAQ</a>
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
        <div className="landing-container landing-hero-intro">
          <p className="landing-brand-signal landing-anim landing-anim--1">Clickforms</p>
          <h1 className="landing-hero-title landing-anim landing-anim--2">
            Forms that run your operations — not the other way around
          </h1>
          <p className="landing-hero-lead landing-anim landing-anim--3">
            Build intake, consent, and service agreements. Collect signatures, route approvals, and
            review submissions in one secure workspace.
          </p>
          <div className="landing-hero-actions landing-anim landing-anim--4">
            <Link className="landing-btn landing-btn--primary landing-btn--lg" href={primaryHref}>
              {primaryLabel}
              <ArrowRightIcon />
            </Link>
            <a className="landing-btn landing-btn--ghost landing-btn--lg" href="#product">
              See the product
            </a>
          </div>
          <ul className="landing-hero-pills landing-anim landing-anim--4">
            <li>Conditional logic</li>
            <li>E-signatures</li>
            <li>Org branding</li>
            <li>Audit trail</li>
          </ul>
        </div>

        <div className="landing-hero-plane landing-anim landing-anim--5" aria-hidden="true">
          <div className="landing-hero-plane-inner">
            <div className="landing-stage">
              <div className="landing-stage-chrome">
                <div className="landing-stage-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="landing-stage-tabs">
                  <span className="landing-stage-tab landing-stage-tab--active">Builder</span>
                  <span className="landing-stage-tab">Preview</span>
                  <span className="landing-stage-tab">Settings</span>
                </div>
                <div className="landing-stage-status">
                  <span className="landing-stage-status-dot" />
                  Draft · Consent form
                </div>
              </div>
              <div className="landing-stage-body">
                <aside className="landing-stage-rail">
                  <p className="landing-stage-rail-label">Fields</p>
                  {['Short text', 'Date', 'File upload', 'Signature', 'Section'].map((label, i) => (
                    <div
                      key={label}
                      className={`landing-stage-field-chip${i === 3 ? ' landing-stage-field-chip--active' : ''}`}
                    >
                      {label}
                    </div>
                  ))}
                </aside>
                <div className="landing-stage-canvas">
                  <div className="landing-stage-banner">Participant details</div>
                  <div className="landing-stage-row">
                    <div className="landing-stage-field">
                      <span>Full name</span>
                      <div className="landing-stage-input landing-stage-input--filled">
                        Jordan Ellis
                      </div>
                    </div>
                  </div>
                  <div className="landing-stage-row landing-stage-row--split">
                    <div className="landing-stage-field">
                      <span>Email</span>
                      <div className="landing-stage-input landing-stage-input--filled">
                        jordan@example.org
                      </div>
                    </div>
                    <div className="landing-stage-field">
                      <span>Date of birth</span>
                      <div className="landing-stage-input">Select date</div>
                    </div>
                  </div>
                  <div className="landing-stage-banner landing-stage-banner--secondary">
                    Consent & signature
                  </div>
                  <div className="landing-stage-sig">
                    <svg
                      className="landing-sig-path"
                      viewBox="0 0 180 48"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 32 C 28 8, 48 44, 68 22 S 108 6, 148 30"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Jordan Ellis · 18 Jul 2026</span>
                  </div>
                </div>
                <aside className="landing-stage-props">
                  <p className="landing-stage-rail-label">Field</p>
                  <p className="landing-stage-props-title">Signature</p>
                  <div className="landing-stage-prop">
                    <span>Required</span>
                    <strong>Yes</strong>
                  </div>
                  <div className="landing-stage-prop">
                    <span>Capture date</span>
                    <strong>On</strong>
                  </div>
                  <div className="landing-stage-prop">
                    <span>Page</span>
                    <strong>2 of 2</strong>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-stats">
        <div className="landing-container landing-stats-inner">
          {STATS.map((stat) => (
            <div key={stat.label} className="landing-stat">
              <span className="landing-stat-value">{stat.value}</span>
              <span className="landing-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" id="capabilities">
        <div className="landing-container">
          <div className="landing-section-head">
            <p className="landing-eyebrow">Capabilities</p>
            <h2 className="landing-h2">Everything your form workflow needs — in one place</h2>
          </div>
          <div className="landing-capabilities">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.num} className="landing-capability">
                  <span className="landing-capability-icon">
                    <Icon />
                  </span>
                  <span className="landing-capability-num">{item.num}</span>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--product" id="product">
        <div className="landing-container">
          <div className="landing-product-block">
            <div className="landing-product-copy">
              <p className="landing-eyebrow">Builder</p>
              <h2 className="landing-h2">Compose forms the way your process actually works</h2>
              <p className="landing-section-lead">
                Fifteen-plus field types, multi-page structure, and live preview. Design once —
                publish when the team is ready.
              </p>
              <ul className="landing-checklist">
                <li>Conditional logic and section breaks</li>
                <li>File uploads and e-signatures</li>
                <li>Organisation branding on every page</li>
              </ul>
            </div>
            <div className="landing-product-visual" aria-hidden="true">
              <div className="landing-mini-stage landing-mini-stage--builder">
                <div className="landing-mini-stage-bar">
                  <span>Intake form</span>
                  <span className="landing-mini-badge">Editing</span>
                </div>
                <div className="landing-mini-stage-grid">
                  <div className="landing-mini-palette">
                    {['Text', 'Choice', 'Sign', 'File', 'Date'].map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </div>
                  <div className="landing-mini-canvas">
                    <div className="landing-mini-block landing-mini-block--green" />
                    <div className="landing-mini-line" />
                    <div className="landing-mini-line landing-mini-line--short" />
                    <div className="landing-mini-block" />
                    <div className="landing-mini-line" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-product-block landing-product-block--reverse">
            <div className="landing-product-copy">
              <p className="landing-eyebrow">Submissions</p>
              <h2 className="landing-h2">Review every response without leaving the portal</h2>
              <p className="landing-section-lead">
                A clear workspace for search, filter, and inspection — so compliance and operations
                stay aligned.
              </p>
              <ul className="landing-checklist">
                <li>Instant arrival as forms are completed</li>
                <li>Status tracking for review workflows</li>
                <li>Export-ready structured answers</li>
              </ul>
            </div>
            <div className="landing-product-visual" aria-hidden="true">
              <div className="landing-mini-stage landing-mini-stage--table">
                <div className="landing-mini-stage-bar">
                  <span>Submissions</span>
                  <span className="landing-mini-badge landing-mini-badge--soft">12 today</span>
                </div>
                <div className="landing-table">
                  <div className="landing-table-head">
                    <span>Form</span>
                    <span>Submitted</span>
                    <span>Status</span>
                  </div>
                  <div className="landing-table-row">
                    <span>Client intake</span>
                    <span>Today, 9:14</span>
                    <span className="landing-status landing-status--ok">Complete</span>
                  </div>
                  <div className="landing-table-row">
                    <span>Consent form</span>
                    <span>Today, 8:02</span>
                    <span className="landing-status landing-status--ok">Complete</span>
                  </div>
                  <div className="landing-table-row">
                    <span>Incident report</span>
                    <span>Yesterday</span>
                    <span className="landing-status landing-status--warn">Review</span>
                  </div>
                  <div className="landing-table-row">
                    <span>Service agreement</span>
                    <span>Yesterday</span>
                    <span className="landing-status landing-status--ok">Complete</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--tinted" id="security">
        <div className="landing-container">
          <div className="landing-section-head">
            <p className="landing-eyebrow">Security &amp; trust</p>
            <h2 className="landing-h2">Built to survive a compliance review</h2>
            <p className="landing-section-lead">
              Every form, submission, and permission change leaves a trace — so your team can answer
              "who saw this" without digging through email.
            </p>
          </div>
          <div className="landing-security-grid">
            {SECURITY_FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="landing-security-item">
                  <span className="landing-security-icon">
                    <Icon />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--cases" id="use-cases">
        <div className="landing-container">
          <div className="landing-section-head">
            <p className="landing-eyebrow">Use cases</p>
            <h2 className="landing-h2">Built for the forms your team runs every day</h2>
            <p className="landing-section-lead">
              From client onboarding to incident reporting — workflows your organisation already
              understands.
            </p>
          </div>
          <div className="landing-cases">
            {USE_CASES.map((item) => (
              <article key={item.title} className="landing-case">
                <span className="landing-case-domain">{item.domain}</span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="workflow">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head--center">
            <p className="landing-eyebrow">Workflow</p>
            <h2 className="landing-h2">Live in three steps</h2>
          </div>
          <ol className="landing-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="landing-step">
                <span className="landing-step-index">{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-section" id="faq">
        <div className="landing-container landing-faq-layout">
          <div className="landing-section-head">
            <p className="landing-eyebrow">FAQ</p>
            <h2 className="landing-h2">Questions worth answering upfront</h2>
            <p className="landing-section-lead">
              Can't find what you're after? Sign in and ask your admin, or reach your Clickforms
              workspace owner directly.
            </p>
          </div>
          <div className="landing-faq-list">
            {FAQS.map((item, index) => (
              <details key={item.q} className="landing-faq-item" open={index === 0}>
                <summary className="landing-faq-question">
                  <span>{item.q}</span>
                  <ChevronDownIcon />
                </summary>
                <p className="landing-faq-answer">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-container landing-cta-inner">
          <p className="landing-cta-brand">Clickforms</p>
          <h2 className="landing-cta-title">Ready when your team is</h2>
          <p className="landing-cta-lead">
            {isAuthenticated
              ? 'Continue to your portal to build forms, review submissions, and manage workflows.'
              : 'Sign in to build forms, review submissions, and manage your organisation’s workflows.'}
          </p>
          <div className="landing-cta-actions">
            <Link className="landing-btn landing-btn--white landing-btn--lg" href={primaryHref}>
              {primaryLabel}
              <ArrowRightIcon />
            </Link>
            {!isAuthenticated ? (
              <Link
                className="landing-btn landing-btn--ghost-light landing-btn--lg"
                href={secondaryHref}
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-top">
          <div className="landing-footer-brand-col">
            <Link href="/" className="landing-brand landing-brand--footer">
              <BrandMark size={24} id="footer" />
              <span>Clickforms</span>
            </Link>
            <p className="landing-footer-tagline">
              The forms platform for teams that need every submission to hold up.
            </p>
          </div>
          <div className="landing-footer-col">
            <p className="landing-footer-col-title">Product</p>
            <a href="#capabilities">Capabilities</a>
            <a href="#product">Builder &amp; submissions</a>
            <a href="#security">Security &amp; trust</a>
          </div>
          <div className="landing-footer-col">
            <p className="landing-footer-col-title">Learn more</p>
            <a href="#use-cases">Use cases</a>
            <a href="#workflow">Workflow</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="landing-footer-col">
            <p className="landing-footer-col-title">Account</p>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Create account</Link>
          </div>
        </div>
        <div className="landing-container landing-footer-bottom">
          <p>© {new Date().getFullYear()} Clickforms. All rights reserved.</p>
          <p>Built for regulated, detail-heavy workflows.</p>
        </div>
      </footer>
    </div>
  );
}
