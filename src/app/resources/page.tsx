import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { LandingChatBubble } from '@/components/landing/landing-chat-bubble';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingPageHero } from '@/components/landing/landing-page-hero';
import { authOptions } from '@/lib/auth';

const RESOURCE_STATS = [
  { value: '20+', label: 'Field types built in' },
  { value: '8', label: 'Ready-made form categories' },
  { value: '100%', label: 'Structured submissions' },
  { value: 'Full', label: 'Audit trail coverage' },
] as const;

const FORM_TYPES = [
  { name: 'Client intake', tags: 'Demographics, referrals, consent' },
  { name: 'Service agreements', tags: 'Multi-page, e-signature, uploads' },
  { name: 'Consent forms', tags: 'Branded, conditional logic' },
  { name: 'Support plans', tags: 'Goals, outcomes, review dates' },
  { name: 'Incident reports', tags: 'Structured follow-up fields' },
  { name: 'Referrals', tags: 'Routing, file attachments' },
  { name: 'Staff onboarding', tags: 'Role-based access, approvals' },
  { name: 'Participant reviews', tags: 'Signatures, PDF export' },
] as const;

export const metadata: Metadata = {
  title: 'Resources | Clickforms',
  description:
    'Form types Clickforms teams run every day — intake, consent, agreements, and reporting, built for detail-heavy, regulated workflows.',
};

export default async function ResourcesPage() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);
  const secondaryHref = isAuthenticated ? '/forms' : '/signup';
  const secondaryLabel = isAuthenticated ? 'Open workspace' : 'Start from a blank canvas';

  return (
    <div className="landing">
      <LandingNav isAuthenticated={isAuthenticated} />

      <LandingPageHero
        eyebrow="Resources"
        title="Forms your team runs every day"
        lead="Intake, consent, agreements, and reporting — built for detail-heavy, regulated workflows."
      />

      <section className="landing-form-types">
        <div className="landing-container">
          <div className="landing-form-types-grid">
            {FORM_TYPES.map((form) => (
              <article key={form.name} className="landing-form-type">
                <h3>{form.name}</h3>
                <p>{form.tags}</p>
              </article>
            ))}
          </div>
          <p className="landing-form-types-more">
            Need something else? <Link href={secondaryHref}>Start from a blank canvas</Link>
          </p>
        </div>
      </section>

      <section className="landing-band landing-band--center">
        <div className="landing-band-deco landing-band-deco--a" aria-hidden="true" />
        <div className="landing-band-deco landing-band-deco--b" aria-hidden="true" />
        <div className="landing-container landing-band-inner">
          <span className="landing-band-eyebrow">Don&apos;t see it here?</span>
          <h2>Start from a blank canvas instead</h2>
          <p>
            Every field type above is available from scratch, too — build exactly the form your
            workflow needs, then reuse it as a template next time.
          </p>
          <div className="landing-band-actions">
            <Link className="landing-btn landing-btn--cta landing-btn--lg" href={secondaryHref}>
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-stats">
        <div className="landing-container landing-stats-grid">
          {RESOURCE_STATS.map((stat) => (
            <div key={stat.label}>
              <span className="landing-stats-value">{stat.value}</span>
              <span className="landing-stats-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <LandingCta isAuthenticated={isAuthenticated} />
      <LandingFooter />
      <LandingChatBubble />
    </div>
  );
}
