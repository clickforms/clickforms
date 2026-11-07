'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { LocalDate } from '@/components/local-date';
import { useToast } from '@/components/toast';
import type { AdminPromotionCode } from '@/lib/billing/admin';
import { readApiError } from '@/lib/error-message';

type Duration = 'once' | 'repeating' | 'forever';

/** Campaign promotion codes (customer-entered at Checkout). Per-organisation grants live on
 * the organisation's own billing panel. */
export function PromotionsAdminClient() {
  const toast = useToast();
  const [codes, setCodes] = useState<AdminPromotionCode[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/billing/promotion-codes');
      if (!res.ok) {
        setLoadError(await readApiError(res, 'Could not load promotion codes'));
        return;
      }
      const data: { codes: AdminPromotionCode[] } = await res.json();
      setCodes(data.codes);
      setLoadError(null);
    } catch {
      setLoadError('Could not load promotion codes');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(code: AdminPromotionCode) {
    setBusyId(code.id);
    try {
      const res = await fetch(`/api/admin/billing/promotion-codes/${code.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !code.active }),
      });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not update the code'));
        return;
      }
      toast.success(code.active ? 'Code deactivated' : 'Code activated');
      await load();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bo">
      <header className="bo-header">
        <div>
          <Link href="/admin/billing" className="admin-org-back">
            Billing
          </Link>
          <h1 className="bo-title">Promotion codes</h1>
          <p className="bo-lead">
            Codes customers can enter at Checkout. To discount one organisation, use the billing
            panel on its page instead.
          </p>
        </div>
        <button
          type="button"
          className="button button--dark"
          onClick={() => setShowForm((current) => !current)}
        >
          {showForm ? 'Close' : 'New code'}
        </button>
      </header>

      {showForm ? (
        <CreateCodeForm
          onCreated={async () => {
            setShowForm(false);
            await load();
          }}
        />
      ) : null}

      {loadError ? (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      ) : codes === null ? (
        <p className="admin-org-empty">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="admin-org-empty">No promotion codes yet.</p>
      ) : (
        <div className="admin-org-panel">
          <div className="admin-billing-table-wrap">
            <table className="admin-billing-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Used</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id}>
                    <td>
                      <strong>{code.code}</strong>
                      {code.couponName ? (
                        <span className="admin-billing-sub">{code.couponName}</span>
                      ) : null}
                    </td>
                    <td>
                      {code.label}
                      {code.firstTimeOnly ? (
                        <span className="admin-billing-sub">New customers only</span>
                      ) : null}
                    </td>
                    <td>
                      {code.timesRedeemed}
                      {code.maxRedemptions ? ` / ${code.maxRedemptions}` : ''}
                    </td>
                    <td>{code.expiresAt ? <LocalDate iso={code.expiresAt} /> : 'Never'}</td>
                    <td>
                      <span
                        className={`admin-billing-pill admin-billing-pill--${code.active ? 'good' : 'muted'}`}
                      >
                        {code.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="admin-billing-row-actions">
                      <button
                        type="button"
                        className="button button--ghost admin-billing-small"
                        disabled={busyId === code.id}
                        onClick={() => void toggle(code)}
                      >
                        {code.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <a href={code.stripeUrl} target="_blank" rel="noreferrer">
                        Stripe
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateCodeForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [percent, setPercent] = useState('20');
  const [dollars, setDollars] = useState('50');
  const [duration, setDuration] = useState<Duration>('repeating');
  const [durationMonths, setDurationMonths] = useState('2');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [firstTimeOnly, setFirstTimeOnly] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/billing/promotion-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          ...(mode === 'percent'
            ? { percentOff: Number(percent) }
            : { amountCents: Math.round(Number(dollars) * 100) }),
          duration,
          ...(duration === 'repeating' ? { durationMonths: Number(durationMonths) } : {}),
          ...(maxRedemptions ? { maxRedemptions: Number(maxRedemptions) } : {}),
          ...(expiresOn ? { expiresOn } : {}),
          firstTimeOnly,
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res, 'Could not create the code'));
        return;
      }
      toast.success('Promotion code created');
      await onCreated();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-org-panel admin-billing-grant-form" onSubmit={submit}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="admin-org-fields">
        <label className="admin-org-field">
          <span>Code customers type</span>
          <input
            className="text-input"
            required
            placeholder="WELCOME20"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            disabled={saving}
          />
        </label>
        <label className="admin-org-field">
          <span>Internal name</span>
          <input
            className="text-input"
            required
            placeholder="Launch offer"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
          />
        </label>
        <label className="admin-org-field">
          <span>Discount type</span>
          <select
            className="text-input"
            value={mode}
            onChange={(event) => setMode(event.target.value as 'percent' | 'amount')}
            disabled={saving}
          >
            <option value="percent">Percent off</option>
            <option value="amount">Dollar amount off</option>
          </select>
        </label>
        {mode === 'percent' ? (
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
        ) : (
          <label className="admin-org-field">
            <span>Amount off (AUD)</span>
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
        )}
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
        {duration === 'repeating' ? (
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
        <label className="admin-org-field">
          <span>Max uses (optional)</span>
          <input
            className="text-input"
            type="number"
            min={1}
            step={1}
            value={maxRedemptions}
            onChange={(event) => setMaxRedemptions(event.target.value)}
            disabled={saving}
          />
        </label>
        <label className="admin-org-field">
          <span>Expires on (optional)</span>
          <input
            className="text-input"
            type="date"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
            disabled={saving}
          />
        </label>
      </div>
      <label className="admin-billing-check">
        <input
          type="checkbox"
          checked={firstTimeOnly}
          onChange={(event) => setFirstTimeOnly(event.target.checked)}
          disabled={saving}
        />
        New customers only
      </label>
      <div className="admin-org-form-actions">
        <button type="submit" className="button button--dark" disabled={saving}>
          {saving ? 'Creating…' : 'Create code'}
        </button>
      </div>
    </form>
  );
}
