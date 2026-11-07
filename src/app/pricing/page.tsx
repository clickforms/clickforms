import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { LandingChatBubble } from '@/components/landing/landing-chat-bubble';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingPageHero } from '@/components/landing/landing-page-hero';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { authOptions } from '@/lib/auth';
import { pageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
  path: '/pricing',
  title: 'Form Builder Pricing in AUD: Free 7-Day Trial | Clickforms',
  description:
    'Simple Australian-dollar pricing for the Clickforms online form builder. Standard, Business, Professional and Enterprise plans, each with a 7-day free trial and no credit card.',
});

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
