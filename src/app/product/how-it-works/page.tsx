import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { LandingChatBubble } from '@/components/landing/landing-chat-bubble';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';
import { BoltIcon, CheckIcon } from '@/components/landing/landing-icons';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingPageHero } from '@/components/landing/landing-page-hero';
import { authOptions } from '@/lib/auth';

const STEPS = [
  {
    title: 'Build',
    description:
      'Drag and drop from 20+ field types — signatures, uploads, conditional logic — and brand it with your colours and logo.',
  },
  {
    title: 'Publish',
    description:
      'Share a link or embed it. Every form your team publishes inherits your organisation’s branding automatically.',
  },
  {
    title: 'Collect',
    description:
      'Clients fill it out on any device. Conditional logic only shows the questions that apply to them.',
  },
  {
    title: 'Review',
    description:
      'Structured, searchable submissions arrive instantly, with role-based approvals and a full audit trail.',
  },
] as const;

export const metadata: Metadata = {
  title: 'How it works | Clickforms',
  description:
    'Build, publish, collect, and review — how Clickforms turns intake and consent into structured, audit-ready submissions.',
};

export default async function HowItWorksPage() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="landing">
      <LandingNav isAuthenticated={isAuthenticated} />

      <LandingPageHero
        eyebrow="Product"
        title="How it works"
        lead="From a blank canvas to a signed, structured submission — four steps, no code required."
      />

      <section className="landing-steps">
        <div className="landing-container">
          <div className="landing-steps-grid">
            {STEPS.map((step, index) => (
              <article key={step.title} className="landing-step">
                <span className="landing-step-number">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-priority">
        <div className="landing-container landing-priority-inner">
          <div className="landing-priority-copy">
            <h2>What your team sees, end to end.</h2>
            <p>
              Publish a form once, and every submission arrives already structured — no more
              re-typing PDF attachments into a spreadsheet, and no gap between what was submitted
              and what your review can trust.
            </p>
          </div>
          <div className="landing-hero-widget">
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
                <span>Arrives</span>
                <span className="landing-widget-pill">Instantly</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <LandingCta isAuthenticated={isAuthenticated} />
      <LandingFooter />
      <LandingChatBubble />
    </div>
  );
}
