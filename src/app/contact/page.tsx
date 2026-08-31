import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { LandingContactForm } from '@/components/landing/landing-contact-form';
import { LandingFooter } from '@/components/landing/landing-footer';
import { MailIcon, PhoneIcon } from '@/components/landing/landing-icons';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingPageHero } from '@/components/landing/landing-page-hero';
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

      <LandingPageHero
        eyebrow="Contact"
        title="Get in touch"
        lead="Questions about a form, your account, or Clickforms in general — we're happy to help."
      />

      <section className="landing-contact">
        <div className="landing-container landing-contact-grid">
          <div className="landing-contact-info">
            <a className="landing-contact-item" href="mailto:admin@clickforms.com.au">
              <span className="landing-contact-item-icon">
                <MailIcon />
              </span>
              <span>
                <span className="landing-contact-item-label">Email</span>
                <span className="landing-contact-item-value">admin@clickforms.com.au</span>
              </span>
            </a>
            <a className="landing-contact-item" href="tel:+61415282494">
              <span className="landing-contact-item-icon">
                <PhoneIcon />
              </span>
              <span>
                <span className="landing-contact-item-label">Phone</span>
                <span className="landing-contact-item-value">+61 415 282 494</span>
              </span>
            </a>
          </div>

          <LandingContactForm />
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
