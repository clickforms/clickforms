import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { LandingChatBubble } from '@/components/landing/landing-chat-bubble';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';
import { ArrowRightIcon, DocumentIcon } from '@/components/landing/landing-icons';
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
  {
    name: 'Client intake',
    tags: 'We capture demographics, referrals, and consent in a single guided form, so new clients are fully onboarded before their first appointment — no chasing paperwork after the fact.',
  },
  {
    name: 'Service agreements',
    tags: 'Multi-page agreements with e-signature and file uploads built in, so clients can review, sign, and attach supporting documents from any device without printing a thing.',
  },
  {
    name: 'Consent forms',
    tags: 'Branded to match your organisation, with conditional logic that only shows the clauses that apply — every consent is recorded, timestamped, and easy to produce later.',
  },
  {
    name: 'Support plans',
    tags: 'Track goals, outcomes, and review dates in one structured record, so progress is easy to report on and nothing falls through the cracks between reviews.',
  },
  {
    name: 'Incident reports',
    tags: 'Structured follow-up fields make sure every incident is logged consistently, routed to the right reviewer, and searchable when compliance asks for the history.',
  },
  {
    name: 'Referrals',
    tags: 'Route referrals to the right team automatically, with file attachments included, so nothing gets lost in an inbox between the referral and the first contact.',
  },
  {
    name: 'Staff onboarding',
    tags: 'Role-based access and approval steps mean new hires only see what applies to them, and every sign-off is recorded as part of the same workflow.',
  },
  {
    name: 'Participant reviews',
    tags: 'Signatures and PDF export built in, so completed reviews are ready to file or share the moment they’re submitted — no separate export step required.',
  },
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
          <div className="landing-section-head landing-section-head--center">
            <span className="landing-page-hero-eyebrow">Form library</span>
            <h2>Built for the forms you already run</h2>
            <p className="landing-section-lead">
              Eight ready-made categories, each with the fields, logic, and signatures your workflow
              needs.
            </p>
          </div>

          <div className="landing-form-types-grid">
            {FORM_TYPES.map((form) => (
              <article key={form.name} className="landing-form-type">
                <span className="landing-form-type-icon">
                  <DocumentIcon />
                </span>
                <h3>{form.name}</h3>
                <p>{form.tags}</p>
              </article>
            ))}
          </div>

          <div className="landing-form-types-more-wrap">
            <p className="landing-form-types-more">
              <span>Need something else?</span>
              <Link href={secondaryHref}>
                Start from a blank canvas
                <ArrowRightIcon />
              </Link>
            </p>
          </div>
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
