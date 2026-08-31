import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { LandingChatBubble } from '@/components/landing/landing-chat-bubble';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';
import { ChevronDownIcon } from '@/components/landing/landing-icons';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingPageHero } from '@/components/landing/landing-page-hero';
import { authOptions } from '@/lib/auth';

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
    a: 'Yes — e-signature capture and file/image uploads are both built-in field types, alongside 20+ others.',
  },
] as const;

export const metadata: Metadata = {
  title: 'Help | Clickforms',
  description:
    'Answers to common Clickforms questions about branding, logic, access, and file uploads.',
};

export default async function HelpPage() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="landing">
      <LandingNav isAuthenticated={isAuthenticated} />

      <LandingPageHero
        eyebrow="Help"
        title="Questions worth answering upfront"
        lead="Can't find what you're after? Sign in and ask your workspace admin, or get in touch."
      />

      <section className="landing-section">
        <div className="landing-container landing-faq-layout">
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

      <LandingCta isAuthenticated={isAuthenticated} />
      <LandingFooter />
      <LandingChatBubble />
    </div>
  );
}
