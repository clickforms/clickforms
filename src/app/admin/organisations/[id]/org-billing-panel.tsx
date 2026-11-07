'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { LocalDate } from '@/components/local-date';
import { useToast } from '@/components/toast';
import type { AdminBillingOverview, AdminGrant, AdminInvoice } from '@/lib/billing/admin';
import { readApiError } from '@/lib/error-message';

// Platform-admin billing panel for one organisation (specs/08-billing.md, Phase 2):
// subscription state, invoices with manual "Retry payment", discounts and account credit.
// Types come from the server module as `import type` only, so nothing server-side is bundled.

type GrantKind = 'percent' | 'amount' | 'free_months' | 'credit';
type Duration = 'once' | 'repeating' | 'forever';

const STATUS_LABELS: Record<string, string> = {
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  unpaid: 'Unpaid',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
  paused: 'Paused',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  paid: 'Paid',
  void: 'Void',
  uncollectible: 'Uncollectible',
};

function money(cents: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
}

function statusTone(status: string): 'good' | 'warn' | 'bad' | 'muted' {
  if (status === 'active' || status === 'trialing' || status === 'paid') return 'good';
  if (status === 'past_due' || status === 'open' || status === 'incomplete') return 'warn';
  if (status === 'unpaid' || status === 'uncollectible') return 'bad';
  return 'muted';
}

function toCents(dollars: string): number {
  return Math.round(Number(dollars) * 100);
}

export function OrgBillingPanel({
  organizationId,
  onBillingChanged,
}: {
  organizationId: string;
  /** Called after a change that can alter the organisation's plan/status, so the page refreshes. */
  onBillingChanged: () => void;
}) {
  const toast = useToast();
  const [overview, setOverview] = useState<AdminBillingOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showGrantForm, setShowGrantForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/billing`);
      if (!res.ok) {
        setLoadError(await readApiError(res, 'Could not load billing details'));
        return;
      }
      setOverview(await res.json());
      setLoadError(null);
    } catch {
      setLoadError('Could not load billing details');
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(
    key: string,
    url: string,
    body: unknown,
    method: 'POST' | 'DELETE' = 'POST',
  ): Promise<Response | null> {
    setBusyKey(key);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      });
      return res;
    } catch {
      toast.error('Something went wrong. Please try again.');
      return null;
    } finally {
      setBusyKey(null);
    }
  }

  async function invoiceAction(invoice: AdminInvoice, action: 'retry' | 'void' | 'mark_paid') {
    if (
      action === 'void' &&
      !window.confirm(
        `Void invoice ${invoice.number ?? invoice.id}? The customer will not be charged.`,
      )
    ) {
      return;
    }
    if (
      action === 'mark_paid' &&
      !window.confirm(
        `Mark invoice ${invoice.number ?? invoice.id} as paid outside Stripe (for example a bank transfer)? No card will be charged.`,
      )
    ) {
      return;
    }
    const res = await post(
      `${action}:${invoice.id}`,
      `/api/admin/organizations/${organizationId}/billing/invoices/${invoice.id}`,
      { action },
    );
    if (!res) return;
    if (!res.ok) {
      toast.error(await readApiError(res, 'Could not update the invoice'));
      return;
    }
    const result: { ok: boolean; message?: string } = await res.json();
    if (result.ok) {
      toast.success(
        action === 'retry'
          ? 'Payment succeeded'
          : action === 'void'
            ? 'Invoice voided'
            : 'Invoice marked as paid',
      );
    } else {
      toast.error(result.message ?? 'The payment was declined');
    }
    await load();
    onBillingChanged();
  }

  async function subscriptionAction(action: 'cancel_at_period_end' | 'resume' | 'cancel_now') {
    if (
      action === 'cancel_now' &&
      !window.confirm(
        'Cancel the subscription immediately? Access becomes read-only straight away and no refund is issued automatically.',
      )
    ) {
      return;
    }
    const res = await post(
      `sub:${action}`,
      `/api/admin/organizations/${organizationId}/billing/subscription`,
      { action },
    );
    if (!res) return;
    if (!res.ok) {
      toast.error(await readApiError(res, 'Could not update the subscription'));
      return;
    }
    toast.success(
      action === 'resume'
        ? 'Subscription will renew as normal'
        : action === 'cancel_now'
          ? 'Subscription canceled'
          : 'Subscription will cancel at the end of the period',
    );
    await load();
    onBillingChanged();
  }

  async function revoke(grant: AdminGrant) {
    if (!window.confirm(`Revoke "${grant.label}"? It will stop applying to future invoices.`))
      return;
    const res = await post(
      `revoke:${grant.id}`,
      `/api/admin/organizations/${organizationId}/billing/discounts/${grant.id}`,
      null,
      'DELETE',
    );
    if (!res) return;
    if (!res.ok) {
      toast.error(await readApiError(res, 'Could not revoke the discount'));
      return;
    }
    toast.success('Discount revoked');
    await load();
  }

  if (loadError) {
    return (
      <section className="admin-org-panel" id="admin-org-billing">
        <div className="admin-org-panel-header">
          <h2 className="admin-org-panel-title">Billing</h2>
        </div>
        <p className="form-error admin-billing-pad" role="alert">
          {loadError}
        </p>
      </section>
    );
  }
  if (!overview) {
    return (
      <section className="admin-org-panel" id="admin-org-billing" aria-busy="true">
        <div className="admin-org-panel-header">
          <h2 className="admin-org-panel-title">Billing</h2>
        </div>
        <p className="admin-org-empty admin-billing-pad">Loading billing details…</p>
      </section>
    );
  }

  const subscription = overview.subscription;
  const failedInvoices = overview.invoices.filter((invoice) => invoice.canRetry);
  const canGrant = overview.stripeConfigured;

  return (
    <section className="admin-org-panel" id="admin-org-billing">
      <div className="admin-org-panel-header">
        <div>
          <h2 className="admin-org-panel-title">Billing</h2>
          <p className="admin-org-panel-copy">
            {overview.billingMode === 'stripe'
              ? 'Billed through Stripe. Plan, renewal and payment state come from Stripe and cannot be edited by hand.'
              : 'Billed manually. The customer can subscribe from their Billing tab; discounts granted here are applied when they do.'}
          </p>
        </div>
        {overview.customerUrl ? (
          <a
            className="button button--ghost"
            href={overview.customerUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in Stripe
          </a>
        ) : null}
      </div>

      {!overview.stripeConfigured ? (
        <p className="admin-org-banner admin-org-banner--muted admin-billing-pad">
          Stripe is not configured on this server (no STRIPE_SECRET_KEY).
        </p>
      ) : null}
      {overview.stripeError ? (
        <p className="form-error admin-billing-pad" role="alert">
          Could not reach Stripe: {overview.stripeError}. Invoices and balance may be out of date.
        </p>
      ) : null}

      {subscription ? (
        <dl className="admin-billing-summary">
          <div>
            <dt>Status</dt>
            <dd>
              <span
                className={`admin-billing-pill admin-billing-pill--${statusTone(subscription.status)}`}
              >
                {STATUS_LABELS[subscription.status] ?? subscription.status}
              </span>
              {subscription.cancelAtPeriodEnd ? (
                <span className="admin-billing-pill admin-billing-pill--warn">
                  Cancels at period end
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>
              {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)},{' '}
              {subscription.interval === 'year' ? 'billed annually' : 'billed monthly'}
            </dd>
          </div>
          <div>
            <dt>{subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'}</dt>
            <dd>
              {subscription.currentPeriodEnd ? (
                <LocalDate iso={subscription.currentPeriodEnd} />
              ) : (
                'n/a'
              )}
            </dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>{subscription.discountLabel ?? 'None'}</dd>
          </div>
          <div>
            <dt>Credit balance</dt>
            <dd>
              {overview.balanceCents == null
                ? 'n/a'
                : overview.balanceCents < 0
                  ? money(-overview.balanceCents)
                  : overview.balanceCents > 0
                    ? `${money(overview.balanceCents)} owing`
                    : 'None'}
            </dd>
          </div>
          <div>
            <dt>Stripe</dt>
            <dd>
              <a href={subscription.stripeUrl} target="_blank" rel="noreferrer">
                Subscription
              </a>
            </dd>
          </div>
        </dl>
      ) : null}

      {subscription?.live ? (
        <div className="admin-billing-actions">
          {subscription.cancelAtPeriodEnd ? (
            <button
              type="button"
              className="button button--ghost"
              disabled={busyKey !== null}
              onClick={() => void subscriptionAction('resume')}
            >
              Resume subscription
            </button>
          ) : (
            <button
              type="button"
              className="button button--ghost"
              disabled={busyKey !== null}
              onClick={() => void subscriptionAction('cancel_at_period_end')}
            >
              Cancel at period end
            </button>
          )}
          <button
            type="button"
            className="button button--ghost-danger"
            disabled={busyKey !== null}
            onClick={() => void subscriptionAction('cancel_now')}
          >
            Cancel now
          </button>
        </div>
      ) : null}

      {failedInvoices.length > 0 ? (
        <aside className="admin-org-trial-alert admin-org-trial-alert--warning admin-billing-alert">
          <span className="admin-org-trial-alert-icon" aria-hidden="true">
            !
          </span>
          <div>
            <p className="admin-org-trial-alert-title">
              {failedInvoices.length === 1
                ? '1 invoice is waiting for payment'
                : `${failedInvoices.length} invoices are waiting for payment`}
            </p>
            <p className="admin-org-trial-alert-copy">
              Stripe retries automatically on its schedule. You can also retry now, for example
              after the customer has updated their card.
            </p>
          </div>
        </aside>
      ) : null}

      {overview.customerId ? (
        <div className="admin-billing-block">
          <h3 className="admin-billing-heading">Invoices</h3>
          {overview.invoices.length === 0 ? (
            <p className="admin-org-empty">No invoices yet.</p>
          ) : (
            <div className="admin-billing-table-wrap">
              <table className="admin-billing-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {overview.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.number ?? 'Draft'}</td>
                      <td>
                        <LocalDate iso={invoice.createdAt} />
                      </td>
                      <td>{money(invoice.amountDueCents)}</td>
                      <td>
                        <span
                          className={`admin-billing-pill admin-billing-pill--${statusTone(invoice.status)}`}
                        >
                          {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
                        </span>
                        {invoice.nextPaymentAttemptAt ? (
                          <span className="admin-billing-sub">
                            Next retry <LocalDate iso={invoice.nextPaymentAttemptAt} />
                          </span>
                        ) : null}
                      </td>
                      <td>{invoice.attemptCount}</td>
                      <td className="admin-billing-row-actions">
                        {invoice.canRetry ? (
                          <>
                            <button
                              type="button"
                              className="button button--dark admin-billing-small"
                              disabled={busyKey !== null}
                              onClick={() => void invoiceAction(invoice, 'retry')}
                            >
                              {busyKey === `retry:${invoice.id}` ? 'Retrying…' : 'Retry payment'}
                            </button>
                            <button
                              type="button"
                              className="button button--ghost admin-billing-small"
                              disabled={busyKey !== null}
                              onClick={() => void invoiceAction(invoice, 'mark_paid')}
                            >
                              Mark paid
                            </button>
                            <button
                              type="button"
                              className="button button--ghost admin-billing-small"
                              disabled={busyKey !== null}
                              onClick={() => void invoiceAction(invoice, 'void')}
                            >
                              Void
                            </button>
                          </>
                        ) : null}
                        {invoice.hostedInvoiceUrl ? (
                          <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : null}
                        <a href={invoice.stripeUrl} target="_blank" rel="noreferrer">
                          Stripe
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <div className="admin-billing-block">
        <div className="admin-billing-heading-row">
          <h3 className="admin-billing-heading">Discounts and credit</h3>
          {canGrant ? (
            <button
              type="button"
              className="button button--dark admin-billing-small"
              onClick={() => setShowGrantForm((current) => !current)}
            >
              {showGrantForm ? 'Close' : 'Give discount'}
            </button>
          ) : null}
        </div>

        {showGrantForm ? (
          <GrantForm
            organizationId={organizationId}
            hasLiveSubscription={!!subscription?.live}
            onDone={async () => {
              setShowGrantForm(false);
              await load();
              onBillingChanged();
            }}
          />
        ) : null}

        {overview.grants.length === 0 ? (
          <p className="admin-org-empty">No discounts or credit have been granted.</p>
        ) : (
          <ul className="admin-billing-grants">
            {overview.grants.map((grant) => (
              <li key={grant.id} className="admin-billing-grant">
                <div>
                  <p className="admin-billing-grant-label">
                    {grant.label}
                    <span
                      className={`admin-billing-pill admin-billing-pill--${
                        grant.status === 'applied'
                          ? 'good'
                          : grant.status === 'pending'
                            ? 'warn'
                            : 'muted'
                      }`}
                    >
                      {grant.status === 'pending' ? 'Waiting for subscription' : grant.status}
                    </span>
                  </p>
                  <p className="admin-billing-sub">
                    {grant.reason} · {grant.grantedByEmail} · <LocalDate iso={grant.createdAt} />
                  </p>
                </div>
                {grant.revocable ? (
                  <button
                    type="button"
                    className="button button--ghost admin-billing-small"
                    disabled={busyKey !== null}
                    onClick={() => void revoke(grant)}
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function GrantForm({
  organizationId,
  hasLiveSubscription,
  onDone,
}: {
  organizationId: string;
  hasLiveSubscription: boolean;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<GrantKind>('percent');
  const [percent, setPercent] = useState('20');
  const [dollars, setDollars] = useState('50');
  const [months, setMonths] = useState('2');
  const [duration, setDuration] = useState<Duration>('repeating');
  const [durationMonths, setDurationMonths] = useState('2');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const common = { reason: reason.trim() };
    const durationFields =
      duration === 'repeating'
        ? { duration, durationMonths: Number(durationMonths) }
        : { duration };
    const body =
      kind === 'percent'
        ? { kind, percentOff: Number(percent), ...durationFields, ...common }
        : kind === 'amount'
          ? { kind, amountCents: toCents(dollars), ...durationFields, ...common }
          : kind === 'free_months'
            ? { kind, months: Number(months), ...common }
            : { kind, amountCents: toCents(dollars), ...common };

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/billing/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readApiError(res, 'Could not grant the discount'));
        return;
      }
      toast.success(
        kind === 'credit'
          ? 'Credit added to the account'
          : hasLiveSubscription
            ? 'Discount applied to the subscription'
            : 'Discount saved. It will apply when they subscribe',
      );
      await onDone();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const showDuration = kind === 'percent' || kind === 'amount';

  return (
    <form className="admin-billing-grant-form" onSubmit={submit}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="admin-org-fields">
        <label className="admin-org-field">
          <span>Type</span>
          <select
            className="text-input"
            value={kind}
            onChange={(event) => setKind(event.target.value as GrantKind)}
            disabled={saving}
          >
            <option value="percent">Percent off</option>
            <option value="amount">Dollar amount off</option>
            <option value="free_months">Free months</option>
            <option value="credit">Account credit</option>
          </select>
        </label>

        {kind === 'percent' ? (
          <label className="admin-org-field">
            <span>Percent off</span>
            <input
              className="text-input"
              type="number"
              min={1}
              max={100}
              step={1}
              required
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              disabled={saving}
            />
          </label>
        ) : null}

        {kind === 'amount' || kind === 'credit' ? (
          <label className="admin-org-field">
            <span>{kind === 'credit' ? 'Credit (AUD)' : 'Amount off (AUD)'}</span>
            <input
              className="text-input"
              type="number"
              min={1}
              step="0.01"
              required
              value={dollars}
              onChange={(event) => setDollars(event.target.value)}
              disabled={saving}
            />
          </label>
        ) : null}

        {kind === 'free_months' ? (
          <label className="admin-org-field">
            <span>Free months</span>
            <input
              className="text-input"
              type="number"
              min={1}
              max={24}
              step={1}
              required
              value={months}
              onChange={(event) => setMonths(event.target.value)}
              disabled={saving}
            />
          </label>
        ) : null}

        {showDuration ? (
          <label className="admin-org-field">
            <span>Lasts</span>
            <select
              className="text-input"
              value={duration}
              onChange={(event) => setDuration(event.target.value as Duration)}
              disabled={saving}
            >
              <option value="once">First invoice only</option>
              <option value="repeating">A number of months</option>
              <option value="forever">Forever</option>
            </select>
          </label>
        ) : null}

        {showDuration && duration === 'repeating' ? (
          <label className="admin-org-field">
            <span>Months</span>
            <input
              className="text-input"
              type="number"
              min={1}
              max={36}
              step={1}
              required
              value={durationMonths}
              onChange={(event) => setDurationMonths(event.target.value)}
              disabled={saving}
            />
          </label>
        ) : null}
      </div>

      <label className="admin-org-field">
        <span>Reason (kept in the audit log)</span>
        <input
          className="text-input"
          required
          minLength={3}
          maxLength={300}
          placeholder="e.g. Early customer offer"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={saving}
        />
      </label>

      <p className="admin-billing-sub">
        {kind === 'credit'
          ? 'Credit reduces future invoices until it runs out. It cannot be revoked here once added.'
          : hasLiveSubscription
            ? 'Applies to this organisation’s subscription straight away. Months are counted from today, so a yearly subscriber only benefits if their next invoice falls inside that window. For yearly plans, "First invoice only" is usually what you want.'
            : 'This organisation has no active subscription. The discount is applied automatically at Checkout.'}
      </p>

      <div className="admin-org-form-actions">
        <button type="submit" className="button button--dark" disabled={saving}>
          {saving ? 'Saving…' : 'Grant'}
        </button>
      </div>
    </form>
  );
}
