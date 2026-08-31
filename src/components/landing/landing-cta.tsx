import Link from 'next/link';
import { ArrowRightIcon } from '@/components/landing/landing-icons';

export function LandingCta({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const primaryHref = isAuthenticated ? '/forms' : '/login';
  const primaryLabel = isAuthenticated ? 'Go to portal' : 'Get started';
  const secondaryHref = isAuthenticated ? '/forms' : '/signup';
  const secondaryLabel = isAuthenticated ? 'Open workspace' : 'Create account';

  return (
    <section className="landing-cta">
      <div className="landing-container landing-cta-inner">
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
  );
}
