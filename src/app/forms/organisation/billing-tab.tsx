'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { OrganizationPlanInfo } from '@/app/forms/organisation/organisation-details-client';
import { useToast } from '@/components/toast';
import {
  buildUsageBars,
  formatPrice,
  PLAN_FEATURE_PILLS,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_PRICING,
  planLimitLines,
} from '@/lib/admin/plan-limits';
import { annualTotalCents } from '@/lib/billing/config';
import type { BillingDetails, DiscountSummary } from '@/lib/billing/types';
import { readApiError } from '@/lib/error-message';
import { formatShortDate } from '@/lib/format-date';

function formatDay(iso: string): string {
  return formatShortDate(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function describeDiscount(discount: DiscountSummary): string {
  const amount =
    discount.percentOff !== null
      ? `${discount.percentOff}% off`
      : discount.amountOff !== null
        ? `$${formatPrice(discount.amountOff / 100)} off`
        : 'Discount applied';
  return discount.endsAt ? `${amount} until ${formatDay(discount.endsAt)}` : amount;
}

/** Whole calendar days from today to `iso` (date part only), so a trial ending today is 0. */
function daysUntil(iso: string): number {
  const now = new Date();
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) - today) / 86_400_000);
}

/** Opens the Stripe Customer Portal (card, invoices, cancellation). */
export function useManageBilling() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not open billing'));
        return;
      }
      const data: { url: string } = await res.json();
      window.location.href = data.url;
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return { open, busy };
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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

type Tone = 'good' | 'warn' | 'bad';

interface PlanView {
  plan: OrganizationPlanInfo['plan'];
  statusLabel: string;
  tone: Tone;
  priceLabel: string;
  priceUnit: string;
  dateLabel: string | null;
  dateValue: string | null;
  discount: string | null;
  interval: 'month' | 'year' | null;
}

function buildPlanView(planInfo: OrganizationPlanInfo): PlanView {
  const { billing } = planInfo;
  const sub = billing.billingMode === 'stripe' ? billing.subscription : null;
  const plan = sub?.plan ?? planInfo.plan;
  const monthly = PLAN_PRICING[plan].monthly;
  const interval = sub?.interval ?? null;

  let priceLabel = 'Custom';
  let priceUnit = '';
  if (monthly !== null) {
    if (interval === 'year') {
      priceLabel = `$${formatPrice(annualTotalCents(PLAN_PRICING[plan].annual ?? monthly) / 100)}`;
      priceUnit = 'per year';
    } else {
      priceLabel = `$${formatPrice(monthly)}`;
      priceUnit = 'per month';
    }
  }

  let statusLabel = 'Active';
  let tone: Tone = 'good';
  let dateLabel: string | null = null;
  let dateValue: string | null = null;

  if (planInfo.status === 'suspended') {
    statusLabel = 'Suspended';
    tone = 'bad';
  } else if (sub) {
    if (billing.access === 'read_only') {
      statusLabel = 'Inactive';
      tone = 'bad';
    } else if (sub.stripeStatus === 'past_due') {
      statusLabel = 'Payment failing';
      tone = 'bad';
    } else if (sub.cancelAtPeriodEnd) {
      statusLabel = 'Ending';
      tone = 'warn';
    }
    dateLabel = sub.cancelAtPeriodEnd ? 'Ends on' : 'Next invoice';
    dateValue = sub.currentPeriodEnd;
  } else if (planInfo.status === 'trial') {
    const ended = planInfo.trialEndsAt ? daysUntil(planInfo.trialEndsAt) < 0 : false;
    statusLabel = ended ? 'Trial ended' : 'Trial';
    tone = ended ? 'bad' : 'warn';
    dateLabel = ended ? 'Trial ended' : 'Trial ends';
    dateValue = planInfo.trialEndsAt;
  } else if (planInfo.renewsAt) {
    dateLabel = 'Renews';
    dateValue = planInfo.renewsAt;
  }

  return {
    plan,
    statusLabel,
    tone,
    priceLabel,
    priceUnit,
    dateLabel,
    dateValue,
    discount: sub?.discount ? describeDiscount(sub.discount) : null,
    interval,
  };
}

function Banner({ planInfo }: { planInfo: OrganizationPlanInfo }) {
  const manage = useManageBilling();
  const { billing } = planInfo;
  const sub = billing.billingMode === 'stripe' ? billing.subscription : null;

  if (planInfo.status === 'suspended') {
    return (
      <div className="org-banner org-banner--danger" role="status">
        <div>
          <p className="org-banner-title">Organisation suspended</p>
          <p className="org-banner-body">Contact us to reactivate it.</p>
        </div>
        <Link href="/contact" className="button button--dark button--small">
          Contact us
        </Link>
      </div>
    );
  }

  if (sub) {
    const pastDue = sub.stripeStatus === 'past_due';
    const inactive = billing.access === 'read_only';
    const ending = !inactive && !pastDue && sub.cancelAtPeriodEnd;
    if (!pastDue && !inactive && !ending) return null;
    return (
      <div
        className={`org-banner${inactive ? ' org-banner--danger' : ' org-banner--warning'}`}
        role="status"
      >
        <div>
          <p className="org-banner-title">
            {inactive
              ? 'Your subscription is inactive'
              : pastDue
                ? "Your last payment didn't go through"
                : sub.currentPeriodEnd
                  ? `Your subscription ends on ${formatDay(sub.currentPeriodEnd)}`
                  : 'Your subscription is set to end'}
          </p>
          <p className="org-banner-body">
            {inactive
              ? 'Your workspace is read-only until billing is sorted out. Live forms keep accepting responses and your data is safe.'
              : pastDue
                ? sub.graceDaysLeft !== null
                  ? `Update your payment details within ${sub.graceDaysLeft} ${sub.graceDaysLeft === 1 ? 'day' : 'days'} to keep editing.`
                  : 'Update your payment details to avoid interruption.'
                : 'You can keep using Clickforms until then.'}
          </p>
        </div>
        <button
          type="button"
          className="button button--dark button--small"
          onClick={() => void manage.open()}
          disabled={manage.busy}
        >
          {inactive || pastDue ? 'Update payment' : 'Manage subscription'}
        </button>
      </div>
    );
  }

  if (planInfo.status === 'trial' && planInfo.trialEndsAt) {
    const days = daysUntil(planInfo.trialEndsAt);
    return (
      <div className="org-banner org-banner--warning" role="status">
        <div>
          <p className="org-banner-title">
            {days > 0
              ? `Trial ends in ${days} ${days === 1 ? 'day' : 'days'}`
              : days === 0
                ? 'Trial ends today'
                : 'Your trial has ended'}
          </p>
          <p className="org-banner-body">
            {days >= 0
              ? `Pick a plan before ${formatDay(planInfo.trialEndsAt)} to keep using Clickforms without interruption.`
              : 'Choose a plan to keep editing. Live forms keep accepting responses.'}
          </p>
        </div>
        <Link href="/forms/organisation/plan" className="button button--dark button--small">
          Choose a plan
        </Link>
      </div>
    );
  }
  return null;
}

function SubscriptionPanel({ planInfo }: { planInfo: OrganizationPlanInfo }) {
  const manage = useManageBilling();
  const view = buildPlanView(planInfo);
  const { billing } = planInfo;
  const sub = billing.billingMode === 'stripe' ? billing.subscription : null;
  const live = !!sub && billing.access !== 'read_only';
  const features = PLAN_FEATURE_PILLS.filter((feature) => PLAN_LIMITS[view.plan][feature.key]);
  const included = [...planLimitLines(view.plan), ...features.map((feature) => feature.label)];
  const otherInterval = view.interval === 'year' ? 'month' : 'year';

  return (
    <section className="bl-panel" aria-label="Current subscription">
      <div className="bl-panel-top">
        <div>
          <p className="bl-kicker">Plan</p>
          <h2 className="bl-plan-name">{PLAN_LABELS[view.plan]}</h2>
          <span className={`bl-status bl-status--${view.tone}`}>{view.statusLabel}</span>
        </div>
        <div>
          <p className="bl-kicker">Included in plan</p>
          <ul className="bl-included">
            {included.map((line) => (
              <li key={line}>
                <CheckIcon />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <dl className="bl-facts">
        <div>
          <dt>Price</dt>
          <dd>
            {view.priceLabel}
            {view.priceUnit ? <span className="bl-fact-unit"> {view.priceUnit}</span> : null}
          </dd>
        </div>
        {view.dateLabel && view.dateValue ? (
          <div>
            <dt>{view.dateLabel}</dt>
            <dd>{formatDay(view.dateValue)}</dd>
          </div>
        ) : null}
        {view.interval ? (
          <div>
            <dt>Billing</dt>
            <dd>{view.interval === 'year' ? 'Annual' : 'Monthly'}</dd>
          </div>
        ) : null}
        {view.discount ? (
          <div>
            <dt>Discount</dt>
            <dd>{view.discount}</dd>
          </div>
        ) : null}
        <p className="bl-facts-note">AUD, GST included</p>
      </dl>

      <div className="bl-actions">
        {live ? (
          <>
            <Link
              href={`/forms/organisation/plan?interval=${otherInterval}`}
              className="bl-btn bl-btn--light"
            >
              {view.interval === 'year' ? 'Switch to monthly' : 'Switch to annual and save'}
            </Link>
            <Link href="/forms/organisation/plan" className="bl-btn">
              Change plan
            </Link>
            <button
              type="button"
              className="bl-btn"
              onClick={() => void manage.open()}
              disabled={manage.busy}
            >
              {manage.busy ? 'Opening…' : 'Manage subscription'}
            </button>
          </>
        ) : sub ? (
          <>
            <button
              type="button"
              className="bl-btn bl-btn--light"
              onClick={() => void manage.open()}
              disabled={manage.busy}
            >
              Update payment
            </button>
            <Link href="/forms/organisation/plan" className="bl-btn">
              Change plan
            </Link>
          </>
        ) : (
          <Link href="/forms/organisation/plan" className="bl-btn bl-btn--light">
            {planInfo.status === 'trial'
              ? 'Choose a plan'
              : planInfo.plan === 'free'
                ? 'Upgrade plan'
                : 'Change plan'}
          </Link>
        )}
      </div>
    </section>
  );
}

function useBillingDetails(enabled: boolean) {
  const [details, setDetails] = useState<BillingDetails | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('/api/billing/details')
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        const data: BillingDetails = await res.json();
        if (!cancelled) setDetails(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return { details, failed };
}

function PaymentMethodSection({
  hasStripe,
  details,
  failed,
}: {
  hasStripe: boolean;
  details: BillingDetails | null;
  failed: boolean;
}) {
  const manage = useManageBilling();
  const card = details?.paymentMethod ?? null;

  return (
    <>
      {hasStripe ? (
        <section className="bl-section" aria-label="Payment method">
          <h3 className="bl-section-title">Payment method</h3>
          <div className="bl-card">
            <div className="bl-row">
              <div className="bl-row-main">
                <p className="bl-row-label">Payment method</p>
                {!hasStripe ? (
                  <p className="bl-row-value bl-muted">Added when you subscribe.</p>
                ) : failed ? (
                  <p className="bl-row-value bl-muted">Couldn&apos;t load your card right now.</p>
                ) : !details ? (
                  <span className="bl-skeleton" aria-hidden="true" />
                ) : card?.type === 'link' ? (
                  <p className="bl-row-value">
                    <span className="bl-card-brand">Link</span>
                    <span className="bl-muted">{card.email ?? 'Saved with Link'}</span>
                  </p>
                ) : card ? (
                  <p className="bl-row-value">
                    <span className="bl-card-brand">{card.brand}</span>
                    <span className="bl-card-dots">•••• {card.last4}</span>
                    <span className="bl-muted">
                      Expires {String(card.expMonth).padStart(2, '0')}/
                      {String(card.expYear).slice(-2)}
                    </span>
                  </p>
                ) : (
                  <p className="bl-row-value bl-muted">No card on file.</p>
                )}
              </div>
              {hasStripe ? (
                <button
                  type="button"
                  className="button button--small button--ghost"
                  onClick={() => void manage.open()}
                  disabled={manage.busy}
                >
                  {card ? 'Edit' : 'Add card'}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

const INVOICES_PAGE = 10;

type InvoicePeriod =
  | 'all'
  | 'this-month'
  | 'last-month'
  | '3-months'
  | '12-months'
  | `year:${number}`;
type InvoiceStatusFilter = 'all' | 'paid' | 'open' | 'other';

function inPeriod(createdAt: string, period: InvoicePeriod, now: Date): boolean {
  if (period === 'all') return true;
  const created = new Date(createdAt);
  const monthStart = (offset: number) => new Date(now.getFullYear(), now.getMonth() + offset, 1);
  switch (period) {
    case 'this-month':
      return created >= monthStart(0);
    case 'last-month':
      return created >= monthStart(-1) && created < monthStart(0);
    case '3-months':
      return created >= monthStart(-2);
    case '12-months':
      return created >= monthStart(-11);
    default:
      return created.getFullYear() === Number(period.slice(5));
  }
}

function InvoicesSection({
  hasStripe,
  details,
  failed,
}: {
  hasStripe: boolean;
  details: BillingDetails | null;
  failed: boolean;
}) {
  const [visible, setVisible] = useState(INVOICES_PAGE);
  const [period, setPeriod] = useState<InvoicePeriod>('all');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all');
  const invoices = details?.invoices ?? [];

  const years = [
    ...new Set(invoices.map((invoice) => new Date(invoice.createdAt).getFullYear())),
  ].sort((a, b) => b - a);
  const now = new Date();
  const filtered = invoices.filter(
    (invoice) =>
      inPeriod(invoice.createdAt, period, now) &&
      (statusFilter === 'all' ||
        (statusFilter === 'other'
          ? invoice.status !== 'paid' && invoice.status !== 'open'
          : invoice.status === statusFilter)),
  );
  const filtering = period !== 'all' || statusFilter !== 'all';

  return (
    <>
      {hasStripe ? (
        <section className="bl-section" aria-label="Invoices">
          <div className="bl-section-head">
            <h3 className="bl-section-title">Invoices</h3>
            {invoices.length > 1 ? (
              <div className="bl-filters">
                <select
                  className="bl-select"
                  aria-label="Filter invoices by period"
                  value={period}
                  onChange={(event) => {
                    setPeriod(event.target.value as InvoicePeriod);
                    setVisible(INVOICES_PAGE);
                  }}
                >
                  <option value="all">All time</option>
                  <option value="this-month">This month</option>
                  <option value="last-month">Last month</option>
                  <option value="3-months">Last 3 months</option>
                  <option value="12-months">Last 12 months</option>
                  {years.map((year) => (
                    <option key={year} value={`year:${year}`}>
                      {year}
                    </option>
                  ))}
                </select>
                <select
                  className="bl-select"
                  aria-label="Filter invoices by status"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as InvoiceStatusFilter);
                    setVisible(INVOICES_PAGE);
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="paid">Paid</option>
                  <option value="open">Unpaid</option>
                  <option value="other">Void / other</option>
                </select>
                {filtering ? (
                  <button
                    type="button"
                    className="bl-filter-clear"
                    onClick={() => {
                      setPeriod('all');
                      setStatusFilter('all');
                      setVisible(INVOICES_PAGE);
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="bl-card bl-card--flush">
            {!details && !failed ? (
              <p className="bl-empty">Loading…</p>
            ) : !details || details.invoices.length === 0 ? (
              <p className="bl-empty">No invoices yet.</p>
            ) : filtered.length === 0 ? (
              <p className="bl-empty">No invoices match these filters.</p>
            ) : (
              <table className="bl-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th aria-label="Download" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.number ?? 'Invoice'}</td>
                      <td>{formatDay(invoice.createdAt)}</td>
                      <td>{money(invoice.amountCents)}</td>
                      <td>
                        <span
                          className={`bl-status bl-status--soft bl-status--${
                            invoice.status === 'paid'
                              ? 'good'
                              : invoice.status === 'open'
                                ? 'warn'
                                : 'muted'
                          }`}
                        >
                          {invoice.status === 'paid'
                            ? 'Paid'
                            : invoice.status === 'open'
                              ? 'Unpaid'
                              : invoice.status === 'void'
                                ? 'Void'
                                : 'Uncollectible'}
                        </span>
                      </td>
                      <td className="bl-table-actions">
                        {invoice.hostedInvoiceUrl ? (
                          <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : null}
                        {invoice.pdfUrl ? <a href={invoice.pdfUrl}>PDF</a> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {filtered.length > visible ? (
              <button
                type="button"
                className="bl-more"
                onClick={() => setVisible((current) => current + INVOICES_PAGE)}
              >
                Show more ({filtered.length - visible} older)
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function UsageSection({ planInfo }: { planInfo: OrganizationPlanInfo }) {
  const sub = planInfo.billing.billingMode === 'stripe' ? planInfo.billing.subscription : null;
  const bars = buildUsageBars(sub?.plan ?? planInfo.plan, planInfo.usage);
  return (
    <section className="bl-section" aria-label="Usage">
      <h3 className="bl-section-title">Usage this month</h3>
      <div className="bl-usage">
        {bars.map((bar) => {
          const over = bar.limit !== null && bar.used > bar.limit;
          return (
            <div key={bar.label} className="bl-meter">
              <div className="bl-meter-head">
                <span>{bar.label.replace(' this month', '')}</span>
                <span className={over ? 'bl-meter-over' : undefined}>
                  {bar.percent === null ? 'Unlimited' : `${bar.percent}%`}
                </span>
              </div>
              <div className="bl-meter-track">
                <div
                  className={`bl-meter-fill${over ? ' bl-meter-fill--over' : ''}`}
                  style={{ width: `${bar.percent ?? 100}%` }}
                  data-unlimited={bar.percent === null || undefined}
                />
              </div>
              <p className="bl-meter-value">{bar.formatted}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function BillingTab({ planInfo }: { planInfo: OrganizationPlanInfo }) {
  const hasStripe = planInfo.billing.stripeEnabled && planInfo.billing.billingMode === 'stripe';
  const { details, failed } = useBillingDetails(hasStripe);
  const justPaid = useSearchParams().get('billing') === 'success';
  return (
    <div className="bl">
      {justPaid ? (
        <p className="org-banner org-banner--success" role="status">
          Payment received. Thanks, your plan is active.
        </p>
      ) : null}
      <Banner planInfo={planInfo} />
      <SubscriptionPanel planInfo={planInfo} />
      <PaymentMethodSection hasStripe={hasStripe} details={details} failed={failed} />
      <UsageSection planInfo={planInfo} />
      <InvoicesSection hasStripe={hasStripe} details={details} failed={failed} />
    </div>
  );
}
