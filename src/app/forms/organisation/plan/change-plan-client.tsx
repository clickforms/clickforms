'use client';

import type { OrgPlan } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { OrganizationPlanInfo } from '@/app/forms/organisation/organisation-details-client';
import { useToast } from '@/components/toast';
import {
  formatBytes,
  PLAN_FEATURE_PILLS,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_ORDER,
  PLAN_PRICING,
  type PlanUsage,
} from '@/lib/admin/plan-limits';
import { readApiError } from '@/lib/error-message';

/** Which of the four usage bars would already be over `targetPlan`'s cap given current
 * usage — advisory only, shown as a warning before a self-service plan switch: the
 * switch itself is never blocked by this, since an org that's over-limit from an
 * admin-assigned downgrade is already a normal, supported state (see
 * assertOrgActionsAllowed's siblings in plan-enforcement.ts, which only stop the *next*
 * create/invite/upload, not existing data). Moved here from organisation-details-
 * client.tsx along with the rest of the plan grid — see page.tsx's comment for why. */
function computeOverLimitLabels(targetPlan: OrgPlan, usage: PlanUsage): string[] {
  const limits = PLAN_LIMITS[targetPlan];
  const labels: string[] = [];
  if (limits.maxForms !== null && usage.forms > limits.maxForms) labels.push('Forms');
  if (limits.maxUsers !== null && usage.users > limits.maxUsers) labels.push('Users');
  if (limits.maxStorageBytes !== null && usage.storageBytes > limits.maxStorageBytes) {
    labels.push('Storage');
  }
  if (
    limits.maxSubmissionsPerMonth !== null &&
    usage.submissionsThisMonth > limits.maxSubmissionsPerMonth
  ) {
    labels.push('Submissions this month');
  }
  return labels;
}

function planLimitLines(plan: OrgPlan): string[] {
  const limits = PLAN_LIMITS[plan];
  return [
    limits.maxForms === null ? 'Unlimited forms' : `${limits.maxForms} forms`,
    limits.maxUsers === null ? 'Unlimited users' : `${limits.maxUsers} users`,
    limits.maxStorageBytes === null
      ? 'Unlimited storage'
      : `${formatBytes(limits.maxStorageBytes)} storage`,
    limits.maxSubmissionsPerMonth === null
      ? 'Unlimited submissions'
      : `${limits.maxSubmissionsPerMonth.toLocaleString()} submissions / mo`,
  ];
}

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
}

export function ChangePlanClient({ planInfo: initialPlanInfo }: ChangePlanClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [planInfo, setPlanInfo] = useState(initialPlanInfo);
  const [selectedPlan, setSelectedPlan] = useState<OrgPlan>(initialPlanInfo.plan);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [planChangeError, setPlanChangeError] = useState<string | null>(null);
  // Preview-only — doesn't affect which plan gets saved, just which of the two prices
  // PLAN_PRICING has for each tier is shown on the cards below (mirrors the public
  // /pricing page's toggle, see landing-pricing.tsx).
  const [billingAnnual, setBillingAnnual] = useState(true);
  const overLimitLabels = useMemo(
    () => computeOverLimitLabels(selectedPlan, planInfo.usage),
    [selectedPlan, planInfo.usage],
  );

  async function handleChangePlan() {
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

  return (
    <div className="org-settings">
      <header className="org-settings-header">
        <div>
          <Link href="/forms/organisation?tab=billing" className="org-plan-back-link">
            <BackArrowIcon />
            Billing
          </Link>
          <h1 className="org-settings-title">Change plan</h1>
          <p className="org-settings-lead">
            You&apos;re currently on {PLAN_LABELS[planInfo.plan]}. Select a tier, then confirm —
            existing data is never deleted.
          </p>
        </div>
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
            <span className="org-plan-toggle-save">Save ~15%</span>
          </button>
        </div>
      </header>

      <section className="org-panel org-panel--wide">
        {planChangeError ? (
          <p className="form-error org-settings-error" role="alert">
            {planChangeError}
          </p>
        ) : null}
        <div className="org-plan-grid">
          {PLAN_ORDER.map((planOption) => {
            const current = planOption === planInfo.plan;
            const selected = planOption === selectedPlan;
            const price = billingAnnual
              ? PLAN_PRICING[planOption].annual
              : PLAN_PRICING[planOption].monthly;
            return (
              <button
                key={planOption}
                type="button"
                className={`org-plan-card${selected ? ' org-plan-card--selected' : ''}${current ? ' org-plan-card--current' : ''}`}
                onClick={() => setSelectedPlan(planOption)}
                disabled={isChangingPlan}
                aria-pressed={selected}
              >
                <span className="org-plan-card-top">
                  <span className="org-plan-card-name">{PLAN_LABELS[planOption]}</span>
                  {current ? <span className="org-plan-card-badge">Current</span> : null}
                </span>
                <span className="org-plan-card-price">
                  {price === null ? (
                    'Custom'
                  ) : (
                    <>
                      ${price}
                      <span className="org-plan-card-period"> / mo</span>
                    </>
                  )}
                </span>
                {price !== null ? (
                  <p className="org-plan-card-billing-note">
                    {billingAnnual ? 'billed annually' : 'billed monthly'}
                  </p>
                ) : null}
                <ul className="org-plan-card-limits">
                  {planLimitLines(planOption).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <ul className="org-plan-card-features">
                  {PLAN_FEATURE_PILLS.map((feature) => {
                    const on = PLAN_LIMITS[planOption][feature.key];
                    return (
                      <li
                        key={feature.key}
                        className={on ? 'org-plan-card-feature--on' : 'org-plan-card-feature--off'}
                      >
                        {on ? <CheckIcon /> : null}
                        {feature.label}
                      </li>
                    );
                  })}
                </ul>
              </button>
            );
          })}
        </div>
        {selectedPlan !== planInfo.plan && overLimitLabels.length > 0 ? (
          <p className="org-plan-warning">
            Switching to {PLAN_LABELS[selectedPlan]} would put you over its limit on{' '}
            {overLimitLabels.join(', ')}. Existing data is safe — you just won&apos;t be able to add
            more there until you&apos;re back under the limit.
          </p>
        ) : null}
        <div className="org-plan-confirm">
          <Link href="/forms/organisation?tab=billing" className="button button--ghost">
            Cancel
          </Link>
          <button
            type="button"
            className="button button--dark"
            disabled={
              isChangingPlan || (selectedPlan === planInfo.plan && planInfo.status !== 'trial')
            }
            onClick={() => void handleChangePlan()}
          >
            {isChangingPlan
              ? 'Updating…'
              : selectedPlan === planInfo.plan
                ? planInfo.status === 'trial'
                  ? 'Subscribe'
                  : 'Current plan'
                : `Switch to ${PLAN_LABELS[selectedPlan]}`}
          </button>
        </div>
      </section>
    </div>
  );
}
