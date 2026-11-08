'use client';

import type { OrgPlan } from '@prisma/client';
import Link from 'next/link';
import { useState } from 'react';
import { CheckIcon, StarIcon } from '@/components/landing/landing-icons';
import '@/components/landing/landing-pricing.css';
import { formatPrice, PLAN_PRICING, planLimitLines } from '@/lib/admin/plan-limits';
import { annualTotalCents } from '@/lib/billing/config';

interface PricingTier {
  id: OrgPlan;
  name: string;
  description: string;
  badge?: string;
  limits: readonly string[];
  features: readonly string[];
  ctaLabel: string;
  ctaHref: string;
}

// Dollar amounts live in PLAN_PRICING (src/lib/admin/plan-limits.ts) — the single shared
// source with the Organisation > Billing "Change plan" cards — so only the copy/limits
// that are unique to the marketing page stay here.
const TIERS: readonly PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Try Clickforms on a couple of forms. No card, no time limit.',
    limits: planLimitLines('free'),
    features: ['Signatures & file uploads', 'Conditional logic', 'PDF exports'],
    ctaLabel: 'Get started free',
    ctaHref: '/signup',
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'A small team getting intake and consent off paper.',
    limits: planLimitLines('standard'),
    features: ['Signatures & file uploads', 'Conditional logic', 'PDF exports', 'Email support'],
    ctaLabel: 'Get started',
    ctaHref: '/signup',
  },
  {
    id: 'business',
    name: 'Business',
    description: 'A growing team running intake across multiple programs.',
    badge: 'Most popular',
    limits: planLimitLines('business'),
    features: [
      'Everything in Standard',
      'Remove Clickforms branding',
      'API access',
      'Priority email support',
    ],
    ctaLabel: 'Get started',
    ctaHref: '/signup',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Multiple departments, one shared workspace.',
    limits: planLimitLines('professional'),
    features: ['Everything in Business', 'Custom domain', 'Priority email support'],
    ctaLabel: 'Get started',
    ctaHref: '/signup',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom compliance, infrastructure, or contract needs.',
    limits: planLimitLines('enterprise'),
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
      <div className="landing-container landing-pricing-container">
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
            const price = annual ? PLAN_PRICING[tier.id].annual : PLAN_PRICING[tier.id].monthly;
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
                      <span className="landing-pricing-card-amount">${formatPrice(price)}</span>
                      <span className="landing-pricing-card-period">/mo AUD</span>
                    </>
                  )}
                </div>
                <p className="landing-pricing-card-billing-note">
                  {price === null
                    ? 'Contact us for a tailored quote'
                    : annual
                      ? tier.id === 'free'
                        ? 'free, no time limit'
                        : `billed annually ($${formatPrice(annualTotalCents(price ?? 0) / 100)} / year), incl. GST`
                      : tier.id === 'free'
                        ? 'free, no time limit'
                        : 'billed monthly, incl. GST'}
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
          Start on the Free plan with no credit card and no time limit, and upgrade when your team
          needs more. Prices are in AUD and include GST.
        </p>
      </div>
    </section>
  );
}
