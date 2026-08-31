import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { LandingContactForm } from '@/components/landing/landing-contact-form';
import { LandingFooter } from '@/components/landing/landing-footer';
import { MailIcon, PhoneIcon } from '@/components/landing/landing-icons';
import { LandingNav } from '@/components/landing/landing-nav';
import { authOptions } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Contact | Clickforms',
  description: 'Get in touch with the Clickforms team by email, phone, or message.',
};

export default async function ContactPage() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="landing">
      <LandingNav isAuthenticated={isAuthenticated} />

      <section className="landing-contact-hero">
        <div className="landing-container landing-contact-hero-grid">
          <div className="landing-contact-hero-copy">
            <span className="landing-page-hero-eyebrow">Contact &amp; support</span>
            <h1>What can we help you with?</h1>
            <p>
              Explore our <Link href="/help">Help Center</Link> for answers on common questions, or
              fill out the form and we&apos;ll get back to you within one business day.
            </p>
            <div className="landing-contact-hero-links">
              <a href="mailto:admin@clickforms.com.au">
                <MailIcon />
                admin@clickforms.com.au
              </a>
              <a href="tel:+61415282494">
                <PhoneIcon />
                +61 415 282 494
              </a>
            </div>
          </div>

          <LandingContactForm />
        </div>
      </section>

      <section className="landing-band landing-band--center">
        <div className="landing-band-deco landing-band-deco--a" aria-hidden="true" />
        <div className="landing-band-deco landing-band-deco--b" aria-hidden="true" />
        <div className="landing-container landing-band-inner">
          <span className="landing-band-eyebrow">Looking for a quick answer?</span>
          <h2>Check the Help Center before you write in</h2>
          <p>
            Branding, logic, access, and file uploads — the questions we hear most, answered without
            waiting on a reply.
          </p>
          <div className="landing-band-actions">
            <Link className="landing-btn landing-btn--cta landing-btn--lg" href="/help">
              Visit Help Center
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
