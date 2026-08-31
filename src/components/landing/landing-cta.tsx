import Link from 'next/link';
import { ArrowRightIcon, CheckIcon } from '@/components/landing/landing-icons';

const CTA_FEATURES = ['Free to start', 'No credit card required', 'Set up in minutes'] as const;

export function LandingCta({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const primaryHref = isAuthenticated ? '/forms' : '/login';
  const primaryLabel = isAuthenticated ? 'Go to portal' : 'Get started';
  const secondaryHref = isAuthenticated ? '/forms' : '/signup';
  const secondaryLabel = isAuthenticated ? 'Open workspace' : 'Create account';

  return (
    <section className="landing-cta">
      <div className="landing-container landing-cta-inner">
        <div className="landing-cta-visual" aria-hidden="true">
          <div className="landing-cta-visual-photo" />
          <div className="landing-cta-visual-note">
            <span>Sent</span>
            <span>with</span>
            <span>care</span>
          </div>
        </div>

        <div className="landing-cta-content">
          <span className="landing-page-hero-eyebrow">Get started</span>
          <h2 className="landing-cta-title">Ready when your team is</h2>
          <p className="landing-cta-lead">
            {isAuthenticated
              ? 'Continue to your portal to build forms, review submissions, and manage workflows — everything your team publishes stays branded, structured, and audit-ready.'
              : 'Sign in to build forms, review submissions, and manage your organisation’s workflows — no setup calls, no lengthy onboarding, just a workspace that’s ready when you are.'}
          </p>

          <ul className="landing-cta-features">
            {CTA_FEATURES.map((feature) => (
              <li key={feature}>
                <CheckIcon />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="landing-cta-actions">
            <Link className="landing-btn landing-btn--dark landing-btn--lg" href={primaryHref}>
              {primaryLabel}
              <ArrowRightIcon />
            </Link>
            {!isAuthenticated ? (
              <Link className="landing-btn landing-btn--ghost landing-btn--lg" href={secondaryHref}>
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
