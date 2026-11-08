import type { Metadata } from 'next';
import Link from 'next/link';
import { ReviewForm } from '@/app/review/review-form-client';
import '@/app/review/review.css';
import { BrandMark } from '@/components/brand-mark';

// A link to send customers, not a page to be found through search.
export const metadata: Metadata = {
  title: { absolute: 'Share your review | Clickforms' },
  description: 'Tell us how Clickforms is working for your team.',
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return (
    <main className="rv">
      <section className="rv-hero">
        <span className="rv-shape rv-shape--purple" aria-hidden="true" />
        <span className="rv-shape rv-shape--sand" aria-hidden="true" />
        <div className="rv-column">
          <Link href="/" className="rv-brand" aria-label="Clickforms home">
            <BrandMark size={44} />
            <span className="rv-brand-word">
              <span>Click</span>
              <span>Forms</span>
            </span>
          </Link>
          <p className="rv-eyebrow">
            <span className="rv-eyebrow-dot" aria-hidden="true" />
            Customer reviews
          </p>
          <h1 className="rv-title">
            How&rsquo;s it
            <br />
            going?
          </h1>
          <p className="rv-lead">
            Tell us how Clickforms is working for your team. Takes about a minute, and we might
            feature your words on our website.
          </p>
        </div>
      </section>

      <section className="rv-body">
        <div className="rv-column rv-column--card">
          <ReviewForm />
        </div>
      </section>
    </main>
  );
}
