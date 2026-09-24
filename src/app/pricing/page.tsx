import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { LandingChatBubble } from '@/components/landing/landing-chat-bubble';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingPageHero } from '@/components/landing/landing-page-hero';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { authOptions } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Pricing | Clickforms',
  description:
    'Simple, Australian-dollar pricing for Clickforms — Standard, Business, Professional, and Enterprise plans, each starting with a 7-day free trial.',
};

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="landing">
      <LandingNav isAuthenticated={isAuthenticated} />

      <LandingPageHero
        eyebrow="Pricing"
        title="Plans built for care and compliance teams"
        lead="Start free for 7 days. No credit card required, and every plan is hosted and supported from Australia."
      />

      <LandingPricing />

      <LandingCta isAuthenticated={isAuthenticated} />
      <LandingFooter />
      <LandingChatBubble />
    </div>
  );
}
