import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { LandingChatBubble } from '@/components/landing/landing-chat-bubble';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingPageHero } from '@/components/landing/landing-page-hero';
import { authOptions } from '@/lib/auth';

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

      <LandingCta isAuthenticated={isAuthenticated} />
      <LandingFooter />
      <LandingChatBubble />
    </div>
  );
}
