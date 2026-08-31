import Link from 'next/link';
import { LandingChatBubble } from '@/components/landing/landing-chat-bubble';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';
import {
  ArrowRightIcon,
  BoltIcon,
  ChatBubbleIcon,
  CheckIcon,
  StarIcon,
} from '@/components/landing/landing-icons';
import { LandingNav } from '@/components/landing/landing-nav';

const TRUST_STATS = [
  { value: '4.9', label: 'Avg. team rating', suffix: '★' },
  { value: '20+', label: 'Field types built in' },
  { value: '100%', label: 'Structured submissions' },
  { value: 'Full', label: 'Audit trail coverage' },
] as const;

const TESTIMONIALS = [
  {
    quote:
      'We stopped chasing PDFs in email. Intake and consent now arrive complete, signed, and searchable.',
    name: 'Sarah M.',
    role: 'Operations lead',
  },
  {
    quote:
      'The approval workflow alone saved us hours every week. Nothing goes live without a clear sign-off.',
    name: 'James T.',
    role: 'Compliance manager',
  },
  {
    quote:
      'Conditional logic means clients only see the questions that apply to them. Far fewer incomplete submissions.',
    name: 'Priya K.',
    role: 'Intake coordinator',
  },
  {
    quote:
      'Audit trails made our last review straightforward. We could show exactly who published what, and when.',
    name: 'Daniel R.',
    role: 'Quality & risk',
  },
] as const;

export function LandingPage({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const primaryHref = isAuthenticated ? '/forms' : '/login';
  const primaryLabel = isAuthenticated ? 'Go to portal' : 'Get started';

  return (
    <div className="landing">
      <LandingNav isAuthenticated={isAuthenticated} />

      <section className="landing-hero">
        <div className="landing-hero-banner">
          <div className="landing-hero-deco landing-hero-deco--photo-a" aria-hidden="true" />
          <div className="landing-hero-deco landing-hero-deco--photo-b" aria-hidden="true" />
          <div className="landing-hero-deco landing-hero-deco--blob-a" aria-hidden="true" />
          <div className="landing-hero-deco landing-hero-deco--blob-b" aria-hidden="true" />

          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy landing-anim landing-anim--1">
              <div className="landing-hero-title-wrap">
                <ChatBubbleIcon className="landing-hero-bubble landing-hero-bubble--tl" />
                <h1 className="landing-hero-title">
                  <span>Run forms</span>
                  <span>with care</span>
                </h1>
                <ChatBubbleIcon className="landing-hero-bubble landing-hero-bubble--br" />
              </div>
              <p className="landing-hero-lead">
                Fast, secure &amp; compliant intake for teams across healthcare, NDIS, and regulated
                operations.
              </p>
            </div>

            <div className="landing-hero-widget landing-anim landing-anim--2">
              <div className="landing-widget-header">
                <BoltIcon />
                <span>3 forms live · Intake ready to publish</span>
              </div>

              <div className="landing-widget-stack">
                <div className="landing-widget-field">
                  <span>You collect</span>
                  <div className="landing-widget-input">
                    <strong>Client intake</strong>
                    <span className="landing-widget-tag">Intake</span>
                  </div>
                </div>
                <div className="landing-widget-field">
                  <span>Team receives</span>
                  <div className="landing-widget-input">
                    <strong>Structured submission</strong>
                    <span className="landing-widget-tag">Signed</span>
                  </div>
                </div>
              </div>

              <ul className="landing-widget-features">
                <li>
                  <CheckIcon />
                  <span>Branded forms</span>
                  <span className="landing-widget-pill">Your colours</span>
                </li>
                <li>
                  <CheckIcon />
                  <span>Our fee</span>
                  <strong>FREE</strong>
                </li>
                <li>
                  <CheckIcon />
                  <span>Arrives</span>
                  <span className="landing-widget-pill">Instantly</span>
                </li>
              </ul>

              <div className="landing-widget-total">
                <span>You&apos;ll launch</span>
                <strong>Client intake form</strong>
              </div>

              <Link
                className="landing-btn landing-btn--dark landing-btn--lg landing-widget-cta"
                href={primaryHref}
              >
                {primaryLabel}
                <ArrowRightIcon />
              </Link>
              <p className="landing-widget-note">Free to start. No credit card required.</p>
            </div>
          </div>
        </div>

        <div className="landing-container landing-trust landing-anim landing-anim--3">
          {TRUST_STATS.map((stat) => (
            <div key={stat.label} className="landing-trust-item">
              <span className="landing-trust-value">
                {stat.value}
                {'suffix' in stat ? <StarIcon /> : null}
              </span>
              <span className="landing-trust-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-outcomes" id="stories">
        <div className="landing-container landing-outcomes-inner">
          <div className="landing-outcomes-copy">
            <h2>Helping teams create better outcomes.</h2>
            <p>
              From intake to approval — workflows your organisation already runs, now in one place,
              with nothing left to chase down after the fact.
            </p>
            <Link
              className="landing-btn landing-btn--dark landing-btn--lg"
              href="/product/how-it-works"
            >
              See how it works
            </Link>
          </div>
          <div className="landing-outcomes-visual" aria-hidden="true">
            <div className="landing-outcomes-photo landing-outcomes-photo--a">
              <span className="landing-outcomes-tag">Intake sent</span>
            </div>
            <div className="landing-outcomes-photo landing-outcomes-photo--b">
              <span className="landing-outcomes-badge">
                <CheckIcon />
              </span>
            </div>
            <div className="landing-outcomes-card">
              <div className="landing-outcomes-card-header">
                <span>Review in progress</span>
                <Link href="/product/how-it-works">Track</Link>
              </div>
              <div className="landing-outcomes-progress">
                <span className="landing-outcomes-progress-seg landing-outcomes-progress-seg--done" />
                <span className="landing-outcomes-progress-seg landing-outcomes-progress-seg--done" />
                <span className="landing-outcomes-progress-seg landing-outcomes-progress-seg--active" />
                <span className="landing-outcomes-progress-seg" />
              </div>
              <p className="landing-outcomes-card-meta">Should complete in 6 min</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-testimonials">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head--center">
            <h2>Echoes from the field</h2>
          </div>
          <div className="landing-testimonials-track">
            {TESTIMONIALS.map((item) => (
              <blockquote key={item.name} className="landing-testimonial">
                <p>&ldquo;{item.quote}&rdquo;</p>
                <footer>
                  <strong>{item.name}</strong>
                  <span>{item.role}</span>
                </footer>
              </blockquote>
            ))}
          </div>
          <p className="landing-testimonials-meta">Trusted by care and compliance teams</p>
        </div>
      </section>

      <LandingCta isAuthenticated={isAuthenticated} />
      <LandingFooter />
      <LandingChatBubble />
    </div>
  );
}
