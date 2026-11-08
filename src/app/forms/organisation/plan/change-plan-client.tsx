'use client';

import type { OrgPlan } from '@prisma/client';
import Link from 'next/link';
import '../organisation.css';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { OrganizationPlanInfo } from '@/app/forms/organisation/organisation-details-client';
import { useToast } from '@/components/toast';
import {
  computeOverLimitLabels,
  formatBytes,
  formatPrice,
  PLAN_FEATURE_PILLS,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_ORDER,
  PLAN_PRICING,
  planLimitLines,
} from '@/lib/admin/plan-limits';
import { annualTotalCents } from '@/lib/billing/config';
import { readApiError } from '@/lib/error-message';

const COMPARE_ROWS: { label: string; value: (plan: OrgPlan) => string | boolean }[] = [
  {
    label: 'Forms',
    value: (plan) => {
      const max = PLAN_LIMITS[plan].maxForms;
      return max === null ? 'Unlimited' : String(max);
    },
  },
  {
    label: 'Users',
    value: (plan) => {
      const max = PLAN_LIMITS[plan].maxUsers;
      return max === null ? 'Unlimited' : String(max);
    },
  },
  {
    label: 'Storage',
    value: (plan) => {
      const max = PLAN_LIMITS[plan].maxStorageBytes;
      return max === null ? 'Unlimited' : formatBytes(max);
    },
  },
  {
    label: 'Submissions a month',
    value: (plan) => {
      const max = PLAN_LIMITS[plan].maxSubmissionsPerMonth;
      return max === null ? 'Unlimited' : max.toLocaleString();
    },
  },
  ...PLAN_FEATURE_PILLS.map((feature) => ({
    label: feature.label,
    value: (plan: OrgPlan) => PLAN_LIMITS[plan][feature.key],
  })),
];

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9.5 3.5 4.5 8l5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ChangePlanClientProps {
  planInfo: OrganizationPlanInfo;
  /** Billing interval to preselect (from ?interval=), if the link asked for one. */
  initialInterval: 'month' | 'year' | null;
}

export function ChangePlanClient({
  planInfo: initialPlanInfo,
  initialInterval,
}: ChangePlanClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [planInfo, setPlanInfo] = useState(initialPlanInfo);
  const [selectedPlan, setSelectedPlan] = useState<OrgPlan>(initialPlanInfo.plan);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [planChangeError, setPlanChangeError] = useState<string | null>(null);
  // Preview-only — doesn't affect which plan gets saved, just which of the two prices
  // PLAN_PRICING has for each tier is shown on the cards below (mirrors the public
  // /pricing page's toggle, see landing-pricing.tsx).
  const [billingAnnual, setBillingAnnual] = useState(
    initialInterval
      ? initialInterval === 'year'
      : initialPlanInfo.billing.subscription
        ? initialPlanInfo.billing.subscription.interval === 'year'
        : true,
  );
  const { billing } = planInfo;
  const useStripe = billing.stripeEnabled;
  // A subscription that is still usable: changing plan edits it. Without one (trial, or a
  // lapsed subscription) the customer goes through Checkout instead.
  const hasLiveSubscription =
    useStripe && billing.subscription !== null && billing.access !== 'read_only';
  const interval = billingAnnual ? 'year' : 'month';
  const unchanged =
    selectedPlan === planInfo.plan &&
    (selectedPlan === 'free' ||
      (hasLiveSubscription
        ? billing.subscription?.interval === interval
        : planInfo.status !== 'trial'));
  const overLimitLabels = useMemo(
    () => computeOverLimitLabels(selectedPlan, planInfo.usage),
    [selectedPlan, planInfo.usage],
  );

  async function handleStripePlanChange() {
    if (selectedPlan === 'enterprise') {
      router.push('/contact');
      return;
    }
    if (selectedPlan === 'free') {
      await handleSwitchToFree();
      return;
    }
    setPlanChangeError(null);
    setIsChangingPlan(true);
    try {
      const res = await fetch(
        hasLiveSubscription ? '/api/billing/change-plan' : '/api/billing/checkout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: selectedPlan, interval }),
        },
      );
      if (!res.ok) {
        setPlanChangeError(await readApiError(res, 'Could not change plan'));
        return;
      }
      if (hasLiveSubscription) {
        toast.success(`Switched to the ${PLAN_LABELS[selectedPlan]} plan`);
        router.push('/forms/organisation?tab=billing');
        router.refresh();
        return;
      }
      const data: { url: string } = await res.json();
      // Stripe-hosted Checkout takes over from here and returns to this page.
      window.location.href = data.url;
    } catch {
      setPlanChangeError('Something went wrong. Please try again.');
    } finally {
      setIsChangingPlan(false);
    }
  }

  async function handleSwitchToFree() {
    setPlanChangeError(null);
    setIsChangingPlan(true);
    try {
      const res = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'free' }),
      });
      if (!res.ok) {
        setPlanChangeError(await readApiError(res, 'Could not change plan'));
        return;
      }
      const data: { scheduled: boolean; endsAt: string | null } = await res.json();
      toast.success(
        data.scheduled
          ? 'You will move to the Free plan when your current billing period ends'
          : 'Switched to the Free plan',
      );
      router.push('/forms/organisation?tab=billing');
      router.refresh();
    } catch {
      setPlanChangeError('Something went wrong. Please try again.');
    } finally {
      setIsChangingPlan(false);
    }
  }

  async function handleChangePlan() {
    if (useStripe) {
      await handleStripePlanChange();
      return;
    }
    setPlanChangeError(null);
    setIsChangingPlan(true);
    try {
      const res = await fetch('/api/organization/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      if (!res.ok) {
        setPlanChangeError(await readApiError(res, 'Could not change plan'));
        return;
      }
      const data: {
        plan: Pick<OrganizationPlanInfo, 'plan' | 'status' | 'trialEndsAt' | 'renewsAt'>;
      } = await res.json();
      setPlanInfo((prev) => ({ ...prev, ...data.plan }));
      toast.success(`Switched to the ${PLAN_LABELS[data.plan.plan]} plan`);
      // Back to the Billing tab rather than staying here — this page is a one-shot
      // destination for "change plan", not somewhere to browse after the fact (see
      // page.tsx's comment on why the grid was split out of the Billing tab at all).
      // ?tab=billing makes sure it lands there even though the switch may have just
      // graduated the org from 'trial' to 'active', which would otherwise default the
      // settings page back to the General tab (see organisation-details-client.tsx).
      router.push('/forms/organisation?tab=billing');
    } catch {
      setPlanChangeError('Something went wrong. Please try again.');
    } finally {
      setIsChangingPlan(false);
    }
  }

  const ctaLabel = isChangingPlan
    ? useStripe && !hasLiveSubscription
      ? 'Opening checkout…'
      : 'Updating…'
    : selectedPlan === 'enterprise' && useStripe
      ? 'Contact us'
      : useStripe && !hasLiveSubscription && selectedPlan !== 'free'
        ? `Subscribe to ${PLAN_LABELS[selectedPlan]}`
        : unchanged
          ? 'Current plan'
          : selectedPlan === planInfo.plan
            ? `Switch to ${billingAnnual ? 'annual' : 'monthly'} billing`
            : `Switch to ${PLAN_LABELS[selectedPlan]}`;

  return (
    <div className="org-settings org-ws pl">
      <Link href="/forms/organisation?tab=billing" className="org-plan-back-link">
        <BackArrowIcon />
        Billing
      </Link>

      <header className="pl-header">
        <h1 className="pl-title">Choose your plan</h1>
        <p className="pl-lead">Change any time. Your data is never deleted.</p>
        <div className="org-plan-toggle">
          <button
            type="button"
            className="org-plan-toggle-btn"
            data-active={!billingAnnual || undefined}
            onClick={() => setBillingAnnual(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            className="org-plan-toggle-btn"
            data-active={billingAnnual || undefined}
            onClick={() => setBillingAnnual(true)}
          >
            Annual
            <span className="org-plan-toggle-save">Save up to 16%</span>
          </button>
        </div>
      </header>

      {planChangeError ? (
        <p className="form-error org-settings-error" role="alert">
          {planChangeError}
        </p>
      ) : null}

      <div className="pl-grid">
        {PLAN_ORDER.map((planOption) => {
          const current = planOption === planInfo.plan;
          const selected = planOption === selectedPlan;
          const price = billingAnnual
            ? PLAN_PRICING[planOption].annual
            : PLAN_PRICING[planOption].monthly;
          const annualPerMonth = PLAN_PRICING[planOption].annual;
          const annualTotal =
            billingAnnual && annualPerMonth !== null && annualPerMonth > 0
              ? annualTotalCents(annualPerMonth) / 100
              : null;
          return (
            <button
              key={planOption}
              type="button"
              className={`pl-card${selected ? ' pl-card--selected' : ''}`}
              onClick={() => setSelectedPlan(planOption)}
              disabled={isChangingPlan}
              aria-pressed={selected}
            >
              <span className="pl-card-top">
                <span className="pl-card-name">{PLAN_LABELS[planOption]}</span>
                {current ? <span className="pl-card-badge">Current</span> : null}
              </span>
              <span className="pl-card-price">
                {price === null ? (
                  'Custom'
                ) : (
                  <>
                    ${formatPrice(price)}
                    <span className="pl-card-period"> /month</span>
                  </>
                )}
              </span>
              <span className="pl-card-note">
                {price === null
                  ? 'Tailored to your needs'
                  : planOption === 'free'
                    ? 'Free, no time limit'
                    : annualTotal !== null
                      ? `$${formatPrice(annualTotal)} billed yearly`
                      : 'Billed monthly'}
              </span>
              <ul className="pl-card-list">
                {planLimitLines(planOption).map((line) => (
                  <li key={line}>
                    <CheckIcon />
                    {line}
                  </li>
                ))}
              </ul>
              <span className="pl-card-cta">
                {current ? 'Current plan' : selected ? 'Selected' : 'Select plan'}
              </span>
            </button>
          );
        })}
      </div>

      {selectedPlan !== planInfo.plan && overLimitLabels.length > 0 ? (
        <p className="org-plan-warning">
          Switching to {PLAN_LABELS[selectedPlan]} would put you over its limit on{' '}
          {overLimitLabels.join(', ')}. Your data is safe, but you won&apos;t be able to add more
          there until you&apos;re back under the limit.
        </p>
      ) : null}

      <section className="pl-compare-wrap" aria-label="Compare features">
        <h2 className="pl-compare-title">Compare features</h2>
        <div className="pl-compare-scroll">
          <table className="pl-compare">
            <thead>
              <tr>
                <th aria-label="Feature" />
                {PLAN_ORDER.map((planOption) => (
                  <th
                    key={planOption}
                    className={planOption === selectedPlan ? 'pl-col--selected' : undefined}
                  >
                    {PLAN_LABELS[planOption]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {PLAN_ORDER.map((planOption) => {
                    const value = row.value(planOption);
                    return (
                      <td
                        key={planOption}
                        className={planOption === selectedPlan ? 'pl-col--selected' : undefined}
                      >
                        {value === true ? (
                          <span className="pl-yes">
                            <CheckIcon />
                          </span>
                        ) : value === false ? (
                          <span className="pl-no">-</span>
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pl-confirm">
        <p className="org-plan-gst-note">All prices are in AUD and include GST.</p>
        <div className="pl-confirm-actions">
          <Link href="/forms/organisation?tab=billing" className="button button--ghost">
            Cancel
          </Link>
          <button
            type="button"
            className="button org-button-primary"
            disabled={
              isChangingPlan ||
              (unchanged && !(useStripe && !hasLiveSubscription && selectedPlan !== 'free'))
            }
            onClick={() => void handleChangePlan()}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
