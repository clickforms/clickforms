import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { LandingChatBubble } from '@/components/landing/landing-chat-bubble';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';
import { ArrowRightIcon, CheckIcon } from '@/components/landing/landing-icons';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingPageHero } from '@/components/landing/landing-page-hero';
import { authOptions } from '@/lib/auth';

const SERVICE_FEATURES = [
  {
    title: 'Signatures & uploads',
    description:
      'Capture e-signatures and file uploads as built-in field types — no third-party tools to wire up.',
  },
  {
    title: 'Conditional logic',
    description:
      'Show only the questions that apply, based on earlier answers, across any number of pages.',
  },
  {
    title: 'Approval workflows',
    description:
      'Route submissions to the right reviewer, with a full audit trail of who signed off and when.',
  },
] as const;

export const metadata: Metadata = {
  title: 'Services | Clickforms',
  description:
    'A purpose-built form builder for intake, consent, and service agreements — signatures, uploads, and approval workflows your compliance review can trust.',
};

export default async function ServicesPage() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);
  const primaryHref = isAuthenticated ? '/forms' : '/login';
  const primaryLabel = isAuthenticated ? 'Go to portal' : 'Get started';
  const secondaryHref = isAuthenticated ? '/forms' : '/signup';
  const secondaryLabel = isAuthenticated ? 'Open workspace' : 'Create account';

  return (
    <div className="landing">
      <LandingNav isAuthenticated={isAuthenticated} />

      <LandingPageHero
        eyebrow="Product"
        title="Services"
        lead="What Clickforms handles for your team, from first draft to final submission."
      />

      <section className="landing-priority">
        <div className="landing-container landing-priority-inner">
          <div className="landing-priority-copy">
            <h2>Your priorities can&apos;t wait.</h2>
            <p>
              Leveraging a purpose-built form builder to make it easy, safe, and quick for teams to
              collect intake, consent, and service agreements — including signatures, uploads, and
              approval workflows your compliance review can trust.
            </p>
            <Link className="landing-btn landing-btn--primary landing-btn--lg" href={primaryHref}>
              {primaryLabel}
              <ArrowRightIcon />
            </Link>
          </div>
          <div className="landing-priority-visual" aria-hidden="true">
            <span className="landing-priority-tag">Compliance-ready</span>
            <div className="landing-preview-card">
              <div className="landing-preview-header">
                <span>Submissions</span>
                <span className="landing-preview-pill">12 today</span>
              </div>
              <div className="landing-preview-row">
                <span>Client intake</span>
                <span>Complete</span>
              </div>
              <div className="landing-preview-row">
                <span>Consent form</span>
                <span>Complete</span>
              </div>
              <div className="landing-preview-row landing-preview-row--warn">
                <span>Incident report</span>
                <span>Review</span>
              </div>
            </div>
            <span className="landing-priority-badge">
              <CheckIcon />
            </span>
          </div>
        </div>
      </section>

      <section className="landing-band landing-band--showcase">
        <div className="landing-band-deco landing-band-deco--a" aria-hidden="true" />
        <div className="landing-band-deco landing-band-deco--b" aria-hidden="true" />
        <div className="landing-container">
          <div className="landing-band-showcase-head">
            <span className="landing-band-eyebrow">Included, not extra</span>
            <h2>Everything a regulated workflow needs, out of the box</h2>
          </div>

          <div className="landing-band-showcase-card">
            <div className="landing-band-showcase-intro">
              <p>What&apos;s included</p>
              <p>
                No plugins to install and no separate tools to pay for — every service form starts
                here.
              </p>
            </div>
            <div className="landing-band-showcase-divider" aria-hidden="true" />
            <div className="landing-band-showcase-items">
              {SERVICE_FEATURES.map((feature) => (
                <div key={feature.title} className="landing-band-showcase-item">
                  <span className="landing-band-showcase-icon">
                    <CheckIcon />
                  </span>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-promos">
        <div className="landing-container landing-promos-grid">
          <article className="landing-promo landing-promo--invite">
            <p className="landing-promo-eyebrow">Invite your team</p>
            <h3>Bring coordinators, reviewers, and admins into one workspace</h3>
            <p>
              Role-based access keeps everyone in the right lane — admins, editors, and reviewers
              see exactly what their role allows.
            </p>
            <Link className="landing-btn landing-btn--white landing-btn--sm" href={secondaryHref}>
              {secondaryLabel}
            </Link>
          </article>
          <article className="landing-promo landing-promo--app">
            <p className="landing-promo-eyebrow">Built for regulated workflows</p>
            <h3>Signatures, uploads, and audit trails — out of the box</h3>
            <p>
              E-signatures, file uploads, conditional logic, and export-ready submissions without
              wiring together five different tools.
            </p>
            <Link
              className="landing-btn landing-btn--ghost-light landing-btn--sm"
              href="/resources"
            >
              See form types
            </Link>
          </article>
        </div>
      </section>

      <LandingCta isAuthenticated={isAuthenticated} />
      <LandingFooter />
      <LandingChatBubble />
    </div>
  );
}
