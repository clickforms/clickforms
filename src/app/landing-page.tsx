import Link from 'next/link';
import '@/app/landing-sections.css';
import { JsonLd } from '@/components/json-ld';
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
import { faqJsonLd, organizationJsonLd, softwareJsonLd, websiteJsonLd } from '@/lib/seo/site';
import { SOLUTIONS } from '@/lib/seo/solutions';

const TRUST_STATS = [
  { value: '4.7', label: 'Average customer rating', suffix: '★' },
  { value: '20+', label: 'Field types built in' },
  { value: '100%', label: 'Structured submissions' },
  { value: 'Full', label: 'Audit trail coverage' },
] as const;

/** Customers shown in the "Trusted by" strip. To show a real logo, save it under
 * public/logos/ and set `logo` to its path (for example '/logos/care-circle.png'); until then
 * the name is shown as a wordmark. */
const CUSTOMERS: readonly { name: string; logo?: string }[] = [
  { name: 'Care Circle', logo: '/logos/care-circle.png' },
  { name: 'Harmony Home Disability Services', logo: '/logos/harmony-home.png' },
  { name: 'Australian Care Foundation', logo: '/logos/australian-care-foundation.png' },
  { name: 'Elevate Independence', logo: '/logos/elevate-independence.png' },
  { name: 'Ability Driven Care', logo: '/logos/ability-driven-care.png' },
];

const HOME_FAQS = [
  {
    q: 'What is Clickforms?',
    a: 'Clickforms is an online form builder for teams that collect detailed, regulated information. Build custom multi-page forms, collect e-signatures and file uploads, route changes through approvals and keep every submission searchable.',
  },
  {
    q: 'Does Clickforms support e-signatures?',
    a: 'Yes. A signature field is built in, so people can sign on any device and the signature is stored with their submission.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. The Free plan has no time limit and needs no credit card. Paid plans add more forms, users and submissions, and pricing is in Australian dollars.',
  },
  {
    q: 'Is Clickforms hosted in Australia?',
    a: 'Yes. Clickforms is hosted and supported from Australia.',
  },
  {
    q: 'What happens if I outgrow the Free plan?',
    a: 'Your forms and submissions stay safe. You can upgrade at any time when you need more forms, users or submissions, and cancelling a paid plan returns you to Free.',
  },
  {
    q: 'Can I cancel at any time?',
    a: 'Yes. You can cancel from the Billing tab and keep full access until the end of the period you have already paid for.',
  },
] as const;

export function LandingPage({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const primaryHref = isAuthenticated ? '/forms' : '/login';
  const primaryLabel = isAuthenticated ? 'Go to portal' : 'Get started';

  return (
    <div className="landing">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={softwareJsonLd()} />
      <JsonLd data={faqJsonLd(HOME_FAQS)} />
      <LandingNav isAuthenticated={isAuthenticated} />

      <section className="landing-hero">
        <div className="landing-hero-banner">
          <div className="landing-hero-deco landing-hero-deco--photo-a" aria-hidden="true" />
          <div className="landing-hero-deco landing-hero-deco--photo-b" aria-hidden="true" />
          <div className="landing-hero-deco landing-hero-deco--blob-a" aria-hidden="true" />
          <div className="landing-hero-deco landing-hero-deco--blob-b" aria-hidden="true" />

          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy landing-anim landing-anim--1">
              <p className="landing-hero-kicker">Made in Australia, for care teams</p>
              <div className="landing-hero-title-wrap">
                <ChatBubbleIcon className="landing-hero-bubble landing-hero-bubble--tl" />
                <h1 className="landing-hero-title">
                  <span>Build forms</span>{' '}
                  <span className="landing-hero-title-accent">with care</span>
                </h1>
                <ChatBubbleIcon className="landing-hero-bubble landing-hero-bubble--br" />
              </div>
              <p className="landing-hero-lead">
                The Australian online form builder for custom intake, consent and service agreement
                forms, with e-signatures, conditional logic and approvals for healthcare, NDIS and
                regulated teams.
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
                  <span>E-signatures</span>
                  <span className="landing-widget-pill">Built in</span>
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
              From intake to approval: workflows your organisation already runs, now in one place,
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

      <section className="landing-trusted" aria-label="Customers">
        <div className="landing-container landing-trusted-header">
          <p className="landing-trusted-kicker">Trusted across Australian care</p>
          <h2 className="landing-trusted-title">Trusted by care providers across Australia</h2>
          <p className="landing-trusted-lead">
            Disability and community care teams use Clickforms for intake, consent and approvals.
          </p>
        </div>
        <div className="landing-container">
          <div className="landing-trusted-band">
            <div className="landing-trusted-marquee">
              <div className="landing-trusted-track">
                {[0, 1].map((copy) => (
                  <ul
                    key={copy}
                    className="landing-trusted-logos"
                    aria-hidden={copy === 1 || undefined}
                  >
                    {CUSTOMERS.map((customer) => (
                      <li key={customer.name} className="landing-trusted-item">
                        {customer.logo ? (
                          // biome-ignore lint/performance/noImgElement: small static partner logos
                          <img src={customer.logo} alt={copy === 0 ? customer.name : ''} />
                        ) : (
                          <span className="landing-trusted-wordmark">{customer.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-form-types">
        <div className="landing-container">
          <div className="landing-section-head landing-section-head--center">
            <h2>Online forms for every workflow</h2>
            <p className="landing-section-lead">
              Build custom forms for intake, consent, agreements and more.
            </p>
          </div>
          <div className="landing-form-types-grid">
            {SOLUTIONS.map((item) => (
              <article key={item.slug} className="landing-form-type">
                <h3>
                  <Link href={`/solutions/${item.slug}`}>{item.name}</Link>
                </h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-faq" aria-labelledby="landing-faq-title">
        <div className="landing-container">
          <h2 className="landing-faq-title" id="landing-faq-title">
            Frequently asked questions
          </h2>
          <div className="landing-faq-grid">
            {[
              { id: 'primary', items: HOME_FAQS.slice(0, 3) },
              { id: 'secondary', items: HOME_FAQS.slice(3) },
            ].map((column) => (
              <div key={column.id} className="landing-faq-col">
                {column.items.map((faq) => (
                  <details key={faq.q} className="landing-faq-item">
                    <summary>
                      <span>{faq.q}</span>
                      <span className="landing-faq-chevron" aria-hidden="true">
                        <svg
                          viewBox="0 0 20 20"
                          width="14"
                          height="14"
                          fill="none"
                          aria-hidden="true"
                        >
                          <title>Expand answer</title>
                          <path
                            d="m5 7.5 5 5 5-5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </summary>
                    <p>{faq.a}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingCta isAuthenticated={isAuthenticated} />
      <LandingFooter />
      <LandingChatBubble />
    </div>
  );
}
