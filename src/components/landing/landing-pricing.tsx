'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckIcon, StarIcon } from '@/components/landing/landing-icons';

interface PricingTier {
  id: string;
  name: string;
  description: string;
  /** AUD per month. null means "custom" (Enterprise) — no number is shown. */
  monthly: number | null;
  annual: number | null;
  badge?: string;
  limits: readonly string[];
  features: readonly string[];
  ctaLabel: string;
  ctaHref: string;
}

const TIERS: readonly PricingTier[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'A single admin getting intake and consent off paper.',
    monthly: 49,
    annual: 42,
    limits: ['10 forms', '1 user', '500 MB storage', '1,000 submissions / month'],
    features: ['Signatures & file uploads', 'Conditional logic', 'PDF exports', 'Email support'],
    ctaLabel: 'Start free trial',
    ctaHref: '/signup',
  },
  {
    id: 'business',
    name: 'Business',
    description: 'A growing team running intake across multiple programs.',
    monthly: 129,
    annual: 109,
    badge: 'Most popular',
    limits: ['50 forms', '15 users', '10 GB storage', '10,000 submissions / month'],
    features: [
      'Everything in Standard',
      'Remove Clickforms branding',
      'API access',
      'Priority email support',
    ],
    ctaLabel: 'Start free trial',
    ctaHref: '/signup',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Multiple departments, one shared workspace.',
    monthly: 219,
    annual: 185,
    limits: ['Unlimited forms', '50 users', '50 GB storage', '30,000 submissions / month'],
    features: ['Everything in Business', 'Custom domain', 'Priority email support'],
    ctaLabel: 'Start free trial',
    ctaHref: '/signup',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom compliance, infrastructure, or contract needs.',
    monthly: null,
    annual: null,
    limits: ['Unlimited forms', 'Unlimited users', 'Unlimited storage', 'Unlimited submissions'],
    features: [
      'Everything in Professional',
      'Single sign-on (SSO)',
      'Dedicated support & SLA',
      'Custom contract',
    ],
    ctaLabel: 'Contact us',
    ctaHref: '/contact',
  },
] as const;

export function LandingPricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <section className="landing-pricing">
      <div className="landing-container">
        <div className="landing-pricing-toggle-wrap">
          <div className="landing-pricing-toggle">
            <button
              type="button"
              className="landing-pricing-toggle-btn"
              data-active={!annual || undefined}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              className="landing-pricing-toggle-btn"
              data-active={annual || undefined}
              onClick={() => setAnnual(true)}
            >
              Annual
              <span className="landing-pricing-toggle-save">Save ~15%</span>
            </button>
          </div>
        </div>

        <div className="landing-pricing-grid">
          {TIERS.map((tier) => {
            const price = annual ? tier.annual : tier.monthly;
            return (
              <div
                key={tier.id}
                className="landing-pricing-card"
                data-highlight={Boolean(tier.badge) || undefined}
              >
                {tier.badge ? (
                  <span className="landing-pricing-badge">
                    <StarIcon />
                    {tier.badge}
                  </span>
                ) : null}

                <h3 className="landing-pricing-card-name">{tier.name}</h3>
                <p className="landing-pricing-card-desc">{tier.description}</p>

                <div className="landing-pricing-card-price">
                  {price === null ? (
                    <span className="landing-pricing-card-custom">Custom</span>
                  ) : (
                    <>
                      <span className="landing-pricing-card-amount">${price}</span>
                      <span className="landing-pricing-card-period">/mo AUD</span>
                    </>
                  )}
                </div>
                <p className="landing-pricing-card-billing-note">
                  {price === null
                    ? 'Contact us for a tailored quote'
                    : annual
                      ? 'billed annually'
                      : 'billed monthly'}
                </p>

                <Link
                  className={`landing-btn landing-btn--lg landing-pricing-card-cta ${
                    tier.badge ? 'landing-btn--cta' : 'landing-btn--dark'
                  }`}
                  href={tier.ctaHref}
                >
                  {tier.ctaLabel}
                </Link>

                <ul className="landing-pricing-card-limits">
                  {tier.limits.map((limit) => (
                    <li key={limit}>{limit}</li>
                  ))}
                </ul>

                <ul className="landing-pricing-card-features">
                  {tier.features.map((feature) => (
                    <li key={feature}>
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="landing-pricing-footnote">
          Every plan starts with a 7-day free trial at Standard-level access — no credit card
          required. Prices shown in AUD.
        </p>
      </div>
    </section>
  );
}
