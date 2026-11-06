'use client';

import { useSearchParams } from 'next/navigation';
import '@/app/forms/organisation/organisation.css';
import { range, Sk, SkRegion } from './primitives';

const TABS = ['General', 'System', 'Billing'] as const;

const LEADS = {
  general: 'Your organisation’s identity and contact details.',
  system: 'Response notifications and the header shown at the top of new forms.',
  billing: 'Your current plan, renewal date and what you’ve used this month.',
} as const;

type Tab = keyof typeof LEADS;

function SkSection({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="org-section">
      <header className="org-section-head">
        <h2 className="org-section-title org-title-with-help">{title}</h2>
      </header>
      <div className="org-section-body">
        {rows.map((label) => (
          <div className="org-row" key={label}>
            <div className="org-row-copy">
              <span className="org-label-with-help">
                <span className="org-row-label">{label}</span>
              </span>
            </div>
            <div className="org-row-control">
              <Sk h={38} r={10} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Header({ tab }: { tab: Tab }) {
  return (
    <header className="org-settings-header">
      <div>
        <h1 className="org-settings-title">Organisation</h1>
        <p className="org-settings-lead">{LEADS[tab]}</p>
      </div>
      <div className="org-tabs">
        {TABS.map((label) => (
          <span
            key={label}
            className={`org-tab${label.toLowerCase() === tab ? ' org-tab--active' : ''}`}
          >
            {label}
          </span>
        ))}
      </div>
    </header>
  );
}

function GeneralBody() {
  return (
    <div className="org-settings-stack">
      <section className="org-card org-identity-card">
        <Sk w={72} h={72} r={18} />
        <div className="org-identity-copy">
          <div className="org-card-name-row">
            <Sk w={200} h={22} />
            <Sk w={110} h={22} r="pill" />
          </div>
          <Sk w={180} h={13} style={{ margin: '8px 0' }} />
          <div className="org-identity-actions">
            <Sk w={104} h={30} r="pill" />
          </div>
        </div>
      </section>
      <div className="org-grid-2">
        <SkSection title="Profile" rows={['Organisation name', 'ABN', 'Public URL']} />
        <SkSection title="Contact" rows={['Contact person', 'Contact email', 'Contact phone']} />
      </div>
    </div>
  );
}

function SystemBody() {
  return (
    <div className="org-settings-stack">
      <SkSection title="Notifications" rows={['Email me new responses', 'Notification email']} />
      <section className="org-section">
        <header className="org-section-head">
          <h2 className="org-section-title">Form pre-header</h2>
        </header>
        <div className="org-section-body" style={{ display: 'grid', gap: 12, padding: 16 }}>
          <Sk h={14} w="40%" />
          <Sk h={120} r={12} />
        </div>
      </section>
    </div>
  );
}

function BillingBody() {
  return (
    <div className="org-settings-stack">
      <section className="org-card org-plan-card-summary">
        <div>
          <p className="org-plan-kicker">Current plan</p>
          <div className="org-card-name-row">
            <Sk w={140} h={26} />
            <Sk w={64} h={22} r="pill" />
          </div>
          <Sk w={150} h={12} style={{ marginTop: 8 }} />
        </div>
        <Sk w={112} h={32} r="pill" />
      </section>
      <section className="org-section">
        <header className="org-section-head">
          <h2 className="org-section-title">Usage</h2>
        </header>
        <div className="org-section-body">
          {['Forms', 'Users', 'Storage', 'Submissions this month'].map((label) => (
            <div className="org-row" key={label}>
              <div className="org-row-copy">
                <span className="org-row-label">{label}</span>
              </div>
              <div className="org-row-control">
                <div className="org-usage">
                  <div className="org-usage-track">
                    <Sk h="100%" r="pill" />
                  </div>
                  <Sk w={90} h={12} />
                </div>
              </div>
              <div className="org-row-action">
                <Sk w={32} h={12} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function OrganisationSkeleton() {
  const raw = useSearchParams().get('tab');
  const tab: Tab = raw === 'billing' || raw === 'system' ? raw : 'general';
  return (
    <SkRegion label="Loading organisation settings">
      <div className="org-settings org-ws">
        <Header tab={tab} />
        <div className="org-ws-content">
          {tab === 'general' ? (
            <GeneralBody />
          ) : tab === 'system' ? (
            <SystemBody />
          ) : (
            <BillingBody />
          )}
        </div>
      </div>
    </SkRegion>
  );
}

export function PlanSkeleton() {
  return (
    <SkRegion label="Loading plans">
      <div className="org-settings org-ws">
        <header className="org-settings-header">
          <div>
            <span className="org-plan-back-link">Billing</span>
            <h1 className="org-settings-title">Change plan</h1>
            <p className="org-settings-lead">
              Select a tier, then confirm — existing data is never deleted.
            </p>
          </div>
          <div className="org-plan-toggle">
            <span className="org-plan-toggle-btn" data-active>
              Monthly
            </span>
            <span className="org-plan-toggle-btn">
              Annual
              <span className="org-plan-toggle-save">Save ~15%</span>
            </span>
          </div>
        </header>
        <section className="org-panel org-panel--wide">
          <div className="org-plan-grid">
            {range(4).map((card) => (
              <div className="org-plan-card" key={card}>
                <Sk w={90} h={16} />
                <Sk w={110} h={30} style={{ margin: '12px 0 6px' }} />
                <Sk w={80} h={11} />
                <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                  {range(4).map((line) => (
                    <Sk key={line} h={11} w={`${90 - line * 10}%`} />
                  ))}
                </div>
                <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                  {range(3).map((line) => (
                    <Sk key={line} h={11} w="70%" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="org-plan-confirm">
            <Sk w={80} h={36} r="pill" />
            <Sk w={150} h={36} r="pill" />
          </div>
        </section>
      </div>
    </SkRegion>
  );
}
