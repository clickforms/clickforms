import '@/app/forms/[id]/prefills/prefills.css';
import type { ReactNode } from 'react';
import { range, Sk, SkRegion } from './primitives';
import { SkTable } from './table-skeleton';

export type FormTab = 'builder' | 'responses' | 'prefills' | 'settings';

const TABS: { key: FormTab; label: string; badge?: boolean }[] = [
  { key: 'builder', label: 'Builder' },
  { key: 'responses', label: 'Responses', badge: true },
  { key: 'prefills', label: 'Prefills', badge: true },
  { key: 'settings', label: 'Settings' },
];

/** The workspace chrome (top tabs + status/actions) — shown when the `[id]` layout itself is
 * still loading, so the shell doesn't pop in after a blank skeleton. Uses the real classes. */
export function FormWorkspaceFrameSkeleton({
  active,
  children,
}: {
  active: FormTab;
  children: ReactNode;
}) {
  return (
    <div className="form-workspace">
      <nav className="form-top-nav" aria-label="Form navigation">
        <ul className="form-top-nav-tabs">
          {TABS.map((tab) => (
            <li className="form-top-nav-item" key={tab.key}>
              <span
                className={`form-top-nav-tab ${tab.key === active ? 'form-top-nav-tab--active' : ''}`}
              >
                <span className="form-top-nav-tab-icon">
                  <Sk w={16} h={16} r={4} />
                </span>
                <span className="form-top-nav-tab-label">{tab.label}</span>
                {tab.badge ? (
                  <span className="form-top-nav-tab-badge">
                    <Sk w={10} h={10} />
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="form-top-nav-end">
          <Sk w={70} h={24} r="pill" />
          <div className="form-top-nav-actions">
            <span className="form-top-nav-actions-trigger">Actions</span>
          </div>
        </div>
      </nav>
      <div className="form-workspace-content">{children}</div>
    </div>
  );
}

function ListToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="submissions-toolbar">
      <div className="submissions-toolbar-filters">{children}</div>
    </div>
  );
}

function Pagination() {
  return (
    <div className="submissions-pagination">
      <Sk w={80} h={12} />
      <div className="submissions-pagination-controls">
        <Sk w={32} h={32} r={8} />
        <Sk w={32} h={32} r={8} />
      </div>
    </div>
  );
}

export function ResponsesSkeleton() {
  return (
    <SkRegion label="Loading responses">
      <div className="submissions-page">
        <div className="submissions-page-header">
          <p className="submissions-page-kicker">
            <Sk w={160} h={12} />
          </p>
          <h1 className="submissions-page-title">Responses</h1>
          <p className="submissions-page-subtitle">
            Every response submitted through this form, newest first.
          </p>
        </div>
        <div className="card admin-table-card">
          <ListToolbar>
            <Sk w={260} h={38} r={10} />
            <Sk w={170} h={38} r={10} />
            <Sk w={110} h={26} r="pill" />
          </ListToolbar>
          <SkTable
            tableClassName="submissions-table"
            rows={8}
            columns={[
              { label: 'Name', kind: 'name' },
              { label: 'Submitted at', kind: 'text', w: '70%' },
              { label: 'Status', kind: 'badge' },
              { kind: 'none', className: 'submissions-row-toggle-cell' },
              { label: 'IP address', kind: 'text', w: '55%' },
              { kind: 'icon' },
            ]}
          />
          <Pagination />
        </div>
      </div>
    </SkRegion>
  );
}

export function PrefillsSkeleton() {
  return (
    <SkRegion label="Loading prefills">
      <div className="submissions-page">
        <div className="submissions-page-header">
          <p className="submissions-page-kicker">
            <Sk w={160} h={12} />
          </p>
          <h1 className="submissions-page-title">Prefills</h1>
          <p className="submissions-page-subtitle">
            Forms you&apos;ve sent with answers already filled in. Responses that come back appear
            under Responses, marked as prefilled.
          </p>
        </div>
        <div className="card admin-table-card pf-card">
          <div className="submissions-toolbar">
            <div className="submissions-toolbar-filters">
              <Sk w={240} h={38} r={10} />
              <Sk w={150} h={38} r={10} />
              <Sk w={190} h={24} r="pill" />
              <Sk w={100} h={26} r="pill" />
            </div>
            <Sk w={120} h={36} r="pill" />
          </div>
          <SkTable
            tableClassName="submissions-table pf-list-table"
            rows={7}
            columns={[
              { label: 'Name', kind: 'user', w: '9rem' },
              { label: 'Status', kind: 'badge' },
              { label: 'Date', kind: 'text', w: '60%' },
              { label: 'Created by', kind: 'text', w: '55%' },
              { kind: 'icon' },
            ]}
          />
        </div>
      </div>
    </SkRegion>
  );
}

function SettingsCard({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="form-settings-card">
      <div className="form-settings-card-toggle">
        <Sk w={40} h={40} r={12} />
        <span className="form-settings-card-toggle-copy">
          <span className="contact-details-title">{title}</span>
          <span className="contact-details-intro">{intro}</span>
        </span>
        <Sk w={18} h={18} r={4} />
      </div>
    </div>
  );
}

export function FormSettingsSkeleton() {
  return (
    <SkRegion label="Loading form settings">
      <div className="form-settings-page">
        <div className="form-settings-hero">
          <p className="form-settings-hero-kicker">Form settings</p>
          <h1 className="form-settings-hero-title">Settings</h1>
          <p className="form-settings-hero-lead">
            Control how this form&apos;s responses behave when exported.
          </p>
        </div>
        <div className="form-settings-accordion">
          <SettingsCard
            title="Download filename"
            intro="Build the name every response PDF downloads with. Click a field to insert it, type any extra text, and remove a chip with ×."
          />
          <SettingsCard
            title="Response notifications"
            intro="Choose who gets emailed — with a PDF of the response attached — every time this form receives a new response."
          />
        </div>
      </div>
    </SkRegion>
  );
}

export function SubmissionDetailSkeleton() {
  return (
    <SkRegion label="Loading response">
      <div className="submission-detail-page">
        <div className="submission-detail-header">
          <h1>Submission</h1>
          <div className="submission-detail-header-actions">
            <Sk w={110} h={36} r={10} />
            <Sk w={96} h={36} r={10} />
          </div>
        </div>
        <div className="submission-meta-stack">
          <div className="card submission-meta">
            {['Submitted', 'IP address'].map((label) => (
              <div className="submission-meta-row" key={label}>
                <span className="submission-meta-label">{label}</span>
                <Sk w={150} h={13} />
              </div>
            ))}
          </div>
        </div>
        <div className="card submission-page">
          <Sk w={140} h={20} style={{ marginBottom: 16 }} />
          <dl className="submission-fields">
            {range(6).map((row) => (
              <div className="submission-field-row" key={row}>
                <dt className="submission-field-label">
                  <Sk w={`${40 + (row % 3) * 14}%`} h={12} />
                </dt>
                <dd className="submission-field-value">
                  <Sk w={`${70 - (row % 4) * 10}%`} h={14} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="submission-back-link">&larr; Back to submissions</p>
      </div>
    </SkRegion>
  );
}

/** Builder (read-only/viewing layout, which is how it opens): page switcher above a canvas
 * holding a form-shaped placeholder. */
export function BuilderSkeleton() {
  return (
    <SkRegion label="Loading builder">
      <header className="builder-header builder-header--viewing">
        <div className="builder-header-page-row">
          <Sk w={190} h={36} r="pill" />
        </div>
      </header>
      <div className="builder builder--viewing">
        <div className="builder-workspace builder-workspace--readonly">
          <div className="builder-canvas-column">
            <div className="canvas">
              <div className="canvas-hero">
                <Sk w="45%" h={30} style={{ margin: '0 auto' }} />
              </div>
              <div className="canvas-field-list">
                {range(5).map((field) => (
                  <div key={field} style={{ display: 'grid', gap: 8, padding: '10px 0' }}>
                    <Sk w={`${28 + (field % 3) * 10}%`} h={13} />
                    <Sk h={field === 3 ? 84 : 42} r={10} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SkRegion>
  );
}
