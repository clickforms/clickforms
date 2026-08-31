import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
  YouTubeIcon,
} from '@/components/landing/landing-icons';

const SOCIAL_LINKS = [
  { label: 'Facebook', href: '#', icon: FacebookIcon },
  { label: 'LinkedIn', href: '#', icon: LinkedInIcon },
  { label: 'YouTube', href: '#', icon: YouTubeIcon },
  { label: 'Instagram', href: '#', icon: InstagramIcon },
  { label: 'X', href: '#', icon: XIcon },
] as const;

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer-top">
        <div className="landing-footer-brand-col">
          <Link href="/" className="landing-brand landing-brand--footer">
            <BrandMark size={30} id="footer" />
            <span className="landing-brand-wordmark">
              <span>Click</span>
              <span>forms</span>
            </span>
          </Link>
          <p className="landing-footer-tagline">
            The forms platform for teams that need every submission to hold up.
          </p>
        </div>
        <div className="landing-footer-col">
          <p className="landing-footer-col-title">Product</p>
          <Link href="/product/services">Services</Link>
          <Link href="/product/how-it-works">How it works</Link>
          <Link href="/resources">Form types</Link>
        </div>
        <div className="landing-footer-col">
          <p className="landing-footer-col-title">Learn more</p>
          <Link href="/resources">Resources</Link>
          <Link href="/help">FAQ</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <div className="landing-footer-col">
          <p className="landing-footer-col-title">Account</p>
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Create account</Link>
        </div>
        <div className="landing-footer-col landing-footer-social-col">
          <p className="landing-footer-col-title">Stay connected</p>
          <div className="landing-footer-social">
            {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
              <a key={label} href={href} aria-label={label} className="landing-footer-social-link">
                <Icon />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="landing-container landing-footer-bottom">
        <p>© {new Date().getFullYear()} Clickforms. All rights reserved.</p>
        <p>Built for regulated, detail-heavy workflows.</p>
      </div>
    </footer>
  );
}
