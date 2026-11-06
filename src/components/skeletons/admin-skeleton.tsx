import type { ReactNode } from 'react';
import { range, Sk, SkRegion } from './primitives';
import { type SkColumn, SkTable } from './table-skeleton';

function DirectoryHeader({
  title,
  lead,
  action,
}: {
  title: string;
  lead: string;
  action?: ReactNode;
}) {
  return (
    <header className="admin-orgs-header">
      <div>
        <h1 className="admin-orgs-title">{title}</h1>
        <p className="admin-orgs-lead">{lead}</p>
      </div>
      {action}
    </header>
  );
}

function StatStrip({ labels, className }: { labels: (string | null)[]; className?: string }) {
  return (
    <section className={className ?? 'admin-orgs-directory-stats'}>
      {labels.map((label, index) => (
        <div className="admin-orgs-directory-stat" key={label ?? `stat-${index}`}>
          <span className="admin-orgs-directory-stat-value">
            <Sk w={28} h={22} />
          </span>
          <span className="admin-orgs-directory-stat-label">{label ?? <Sk w={60} h={11} />}</span>
        </div>
      ))}
    </section>
  );
}

function DirectoryCard({
  columns,
  rows = 8,
  searchWidth = 280,
  withToolbar = true,
}: {
  columns: SkColumn[];
  rows?: number;
  searchWidth?: number;
  withToolbar?: boolean;
}) {
  return (
    <div className="card admin-orgs-card">
      {withToolbar ? (
        <div className="admin-orgs-toolbar">
          <Sk w={searchWidth} h={38} r={10} />
        </div>
      ) : null}
      <SkTable baseClass="admin-orgs-table" columns={columns} rows={rows} />
    </div>
  );
}

const ACTION_BUTTON = <Sk w={160} h={38} r="pill" />;

export function AdminHomeSkeleton() {
  return (
    <SkRegion label="Loading admin overview">
      <div className="admin-home">
        <header className="admin-home-header">
          <div className="admin-home-heading">
            <p className="admin-home-kicker">
              <Sk w={130} h={12} />
            </p>
            <h1 className="admin-home-title">
              <Sk w={280} h={30} />
            </h1>
            <p className="admin-home-lead">A snapshot of the platform and the latest changes.</p>
          </div>
          {ACTION_BUTTON}
        </header>

        <section className="admin-home-stats" aria-label="Platform totals">
          {['Organisations', 'Users', 'Forms', 'Responses'].map((label) => (
            <div className="admin-home-stat" key={label}>
              <Sk w={40} h={40} r={12} />
              <span className="admin-home-stat-copy">
                <span className="admin-home-stat-value">
                  <Sk w={44} h={22} />
                </span>
                <span className="admin-home-stat-label">{label}</span>
              </span>
            </div>
          ))}
        </section>

        <div className="admin-home-columns">
          <section className="admin-home-panel">
            <div className="admin-home-panel-header">
              <h2 className="admin-home-panel-title">Recent organisations</h2>
              <span className="admin-home-panel-link">View all</span>
            </div>
            <ul className="admin-home-org-list">
              {range(5).map((row) => (
                <li key={row}>
                  <div className="admin-home-org">
                    <Sk w={36} h={36} r={10} />
                    <span className="admin-home-org-copy">
                      <Sk w={`${50 + (row % 3) * 12}%`} h={13} />
                      <Sk w="35%" h={10} style={{ marginTop: 6 }} />
                    </span>
                    <Sk w={56} h={11} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-home-panel">
            <div className="admin-home-panel-header">
              <h2 className="admin-home-panel-title">Activity</h2>
              <span className="admin-home-panel-link">Audit log</span>
            </div>
            <ul className="admin-home-activity">
              {range(5).map((row) => (
                <li className="admin-home-activity-row" key={row}>
                  <Sk w={28} h={28} r="circle" />
                  <span className="admin-home-activity-copy">
                    <Sk w={`${60 + (row % 3) * 10}%`} h={13} />
                    <Sk w="40%" h={10} style={{ marginTop: 6 }} />
                  </span>
                  <Sk w={48} h={11} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </SkRegion>
  );
}

export function AdminOrganisationsSkeleton() {
  return (
    <SkRegion label="Loading organisations">
      <div className="admin-orgs admin-orgs-directory">
        <DirectoryHeader
          title="Organisations"
          lead="Every organisation on the platform."
          action={ACTION_BUTTON}
        />
        <StatStrip labels={['All', 'Active', 'Trial', 'Suspended']} />
        <DirectoryCard
          columns={[
            { label: 'Organisation', kind: 'user', w: '8rem' },
            { label: 'Plan', kind: 'text', w: '55%' },
            { label: 'Users', kind: 'text', w: '30%' },
            { label: 'Forms', kind: 'text', w: '30%' },
            { label: 'Status', kind: 'badge' },
            { label: 'Created', kind: 'text', w: '60%' },
            { label: 'Actions', kind: 'icon' },
          ]}
        />
      </div>
    </SkRegion>
  );
}

export function AdminUsersSkeleton() {
  return (
    <SkRegion label="Loading users">
      <div className="admin-orgs admin-orgs-directory admin-users-directory">
        <DirectoryHeader title="Users" lead="Every user across every organisation." />
        <StatStrip labels={['All', 'Super admins', 'Org users', '2FA off']} />
        <DirectoryCard
          columns={[
            { label: 'User', kind: 'user', w: '9rem' },
            { label: 'Organisation', kind: 'text', w: '60%' },
            { label: 'Role', kind: 'badge' },
            { label: '2FA', kind: 'badge' },
            { label: 'Joined', kind: 'text', w: '60%' },
            { label: 'Actions', kind: 'icon' },
          ]}
        />
      </div>
    </SkRegion>
  );
}

export function AdminTeamSkeleton() {
  return (
    <SkRegion label="Loading team">
      <div className="admin-orgs admin-orgs-directory admin-users-directory">
        <DirectoryHeader
          title="Team"
          lead="Clickforms staff who can access admin across every organisation."
          action={ACTION_BUTTON}
        />
        <StatStrip labels={['All', 'Super admins', 'Support', 'Pending']} />
        <DirectoryCard
          withToolbar={false}
          rows={5}
          columns={[
            { label: 'Member', kind: 'user', w: '9rem' },
            { label: 'Permission', kind: 'badge' },
            { label: 'Joined', kind: 'text', w: '60%' },
            { label: 'Actions', kind: 'icon' },
          ]}
        />
      </div>
    </SkRegion>
  );
}

export function AdminAuditLogSkeleton() {
  return (
    <SkRegion label="Loading audit log">
      <div className="admin-orgs admin-orgs-directory admin-audit-directory">
        <DirectoryHeader
          title="Audit log"
          lead="Every logged admin and organisation action, most recent first."
        />
        <StatStrip className="admin-audit-stats" labels={['All', null, null, null, null]} />
        <DirectoryCard
          searchWidth={360}
          rows={10}
          columns={[
            { label: 'Activity', kind: 'name' },
            { label: 'Entity', kind: 'text', w: '55%' },
            { label: 'Organisation', kind: 'text', w: '60%' },
            { label: 'When', kind: 'text', w: '55%' },
          ]}
        />
      </div>
    </SkRegion>
  );
}

export function AdminBillingSkeleton() {
  return (
    <SkRegion label="Loading billing">
      <div className="billing-page admin-orgs-directory">
        <header className="admin-orgs-header">
          <div>
            <h1 className="admin-orgs-title">Billing</h1>
            <p className="admin-orgs-lead">Plan, usage, and trial for every organisation.</p>
          </div>
          <Sk w={280} h={38} r={10} />
        </header>
        <StatStrip labels={['All', 'Active', 'Trial', 'Suspended']} />
        <div className="billing-org-list">
          {range(3).map((card) => (
            <article className="org-panel billing-org-card" key={card}>
              <header className="billing-org-head">
                <div className="billing-org-identity">
                  <Sk w={40} h={40} r={12} />
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Sk w={160} h={14} />
                    <Sk w={110} h={11} />
                  </div>
                </div>
                <div className="billing-org-head-meta">
                  <Sk w={90} h={12} />
                  <Sk w={64} h={22} r="pill" />
                </div>
              </header>
              <div className="billing-org-controls" style={{ display: 'grid', gap: 12 }}>
                <Sk h={38} r={10} />
                <Sk h={10} r="pill" />
                <Sk w="70%" h={10} r="pill" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </SkRegion>
  );
}

function BackLink({ label }: { label: string }) {
  return <span className="admin-org-back">{label}</span>;
}

function PanelFields({ labels }: { labels: string[] }) {
  return (
    <div className="admin-org-fields">
      {labels.map((label) => (
        <div className="admin-org-field" key={label}>
          <span>{label}</span>
          <Sk h={38} r={10} />
        </div>
      ))}
    </div>
  );
}

export function AdminOrganisationDetailSkeleton() {
  return (
    <SkRegion label="Loading organisation">
      <div className="admin-org-detail">
        <BackLink label="Organisations" />
        <header className="admin-org-header">
          <div className="admin-org-identity">
            <Sk w={56} h={56} r={16} />
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="admin-org-title-row">
                <Sk w={220} h={24} />
                <Sk w={64} h={22} r="pill" />
              </div>
              <Sk w={260} h={12} />
            </div>
          </div>
          <div className="admin-org-header-actions">
            <Sk w={150} h={38} r="pill" />
            <Sk w={38} h={38} r={10} />
          </div>
        </header>

        <section className="admin-org-stats" aria-label="Organisation snapshot">
          {['Users', 'Pending invites', 'Forms', 'Responses'].map((label) => (
            <div className="admin-org-stat" key={label}>
              <span className="admin-org-stat-value">
                <Sk w={32} h={22} />
              </span>
              <span className="admin-org-stat-label">{label}</span>
            </div>
          ))}
        </section>

        <div className="admin-org-main-grid">
          <section className="admin-org-panel admin-org-panel--plan">
            <div className="admin-org-panel-header">
              <div>
                <h2 className="admin-org-panel-title">Plan &amp; trial</h2>
                <p className="admin-org-panel-copy">
                  Assign a plan, or put this organisation on a trial with a custom end date.
                </p>
              </div>
            </div>
            <div className="admin-org-form">
              <PanelFields labels={['Plan', 'Status', 'Trial ends on']} />
              <Sk w={130} h={38} r="pill" />
            </div>
          </section>

          <section className="admin-org-panel admin-org-panel--people">
            <div className="admin-org-panel-header">
              <div>
                <h2 className="admin-org-panel-title">People</h2>
                <p className="admin-org-panel-copy">Members and outstanding invites.</p>
              </div>
              <Sk w={120} h={38} r="pill" />
            </div>
            <ul style={{ display: 'grid', gap: 14, listStyle: 'none', padding: 0, margin: 0 }}>
              {range(4).map((row) => (
                <li key={row} className="sk-cell-user">
                  <Sk w={32} h={32} r="circle" />
                  <Sk w={`${40 + (row % 3) * 12}%`} h={13} />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="admin-org-panel">
          <div className="admin-org-panel-header">
            <div>
              <h2 className="admin-org-panel-title">Details</h2>
              <p className="admin-org-panel-copy">Name, billing identity, and who to contact.</p>
            </div>
          </div>
          <div className="admin-org-form">
            <PanelFields
              labels={[
                'Organisation name',
                'Subdomain',
                'ABN',
                'Contact person',
                'Contact email',
                'Contact phone',
              ]}
            />
          </div>
        </section>

        <section className="admin-org-danger">
          <div>
            <h2 className="admin-org-panel-title">Delete organisation</h2>
            <p className="admin-org-panel-copy">
              Removes users, forms, responses, and files. This cannot be undone.
            </p>
          </div>
          <Sk w={160} h={38} r="pill" />
        </section>
      </div>
    </SkRegion>
  );
}

export function AdminNewOrganisationSkeleton() {
  return (
    <SkRegion label="Loading form">
      <div className="settings-page">
        <header className="settings-page-header">
          <p className="settings-page-kicker">Clickforms Admin</p>
          <h1 className="settings-page-title">Onboard a new organisation</h1>
          <p className="settings-page-lead">
            Create the organisation and invite its first admin — they&apos;ll set their own password
            via the invite link.
          </p>
        </header>
        <div className="card contact-details-card">
          <div className="contact-details-header">
            <Sk w={40} h={40} r={12} />
            <div>
              <h2 className="contact-details-title">Organisation details</h2>
              <p className="contact-details-intro">
                Who the organisation is and who administers it.
              </p>
            </div>
          </div>
          <dl className="contact-details-list contact-details-list--table contact-details-list--wide-inputs">
            {['Organisation name', 'ABN', 'Billing plan', "Admin's name", "Admin's email"].map(
              (label) => (
                <div className="contact-details-row" key={label}>
                  <dt>{label}</dt>
                  <dd>
                    <Sk h={40} r={10} />
                  </dd>
                </div>
              ),
            )}
          </dl>
          <div className="contact-details-actions">
            <span />
            <Sk w={170} h={38} r="pill" />
          </div>
        </div>
      </div>
    </SkRegion>
  );
}

export function AdminTemplatesSkeleton() {
  return (
    <SkRegion label="Loading templates">
      <div className="admin-orgs admin-orgs-directory admin-templates-directory">
        <DirectoryHeader
          title="Templates"
          lead="Reusable forms organisations can copy from the gallery."
          action={ACTION_BUTTON}
        />
        <StatStrip labels={['All', 'Draft', 'Published', 'Archived']} />
        <DirectoryCard
          columns={[
            { kind: 'check', className: 'admin-orgs-table-check' },
            { label: 'Template', kind: 'user', w: '9rem' },
            { label: 'Industry', kind: 'text', w: '55%' },
            { label: 'Category', kind: 'text', w: '55%' },
            { label: 'Form type', kind: 'text', w: '55%' },
            { label: 'Status', kind: 'badge' },
            { label: 'Updated', kind: 'text', w: '60%' },
            { kind: 'icon' },
          ]}
        />
      </div>
    </SkRegion>
  );
}

export function AdminTemplateDetailSkeleton() {
  return (
    <SkRegion label="Loading template">
      <div className="admin-template">
        <BackLink label="Templates" />
        <header className="admin-org-header">
          <div className="admin-org-identity">
            <Sk w={56} h={56} r={16} />
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="admin-org-title-row">
                <Sk w={240} h={24} />
                <Sk w={72} h={22} r="pill" />
              </div>
              <Sk w={200} h={12} />
            </div>
          </div>
          <div className="admin-org-header-actions">
            <Sk w={120} h={38} r="pill" />
            <Sk w={130} h={38} r="pill" />
          </div>
        </header>
        <div className="admin-template-layout">
          <section className="admin-org-panel admin-template-preview">
            <div className="admin-org-panel-header">
              <div>
                <h2 className="admin-org-panel-title">Gallery card</h2>
                <p className="admin-org-panel-copy">How organisations see this template.</p>
              </div>
            </div>
            <div className="admin-template-preview-body">
              <div className="template-gallery-card admin-template-preview-card">
                <div className="template-gallery-card-thumb">
                  <Sk h="100%" r={0} />
                </div>
                <div className="template-gallery-card-body">
                  <Sk w="70%" h={14} />
                  <Sk w="40%" h={11} style={{ marginTop: 8 }} />
                </div>
              </div>
              <div className="admin-template-thumb-actions">
                <Sk w={130} h={36} r="pill" />
              </div>
            </div>
          </section>
          <section className="admin-org-panel">
            <div className="admin-org-panel-header">
              <div>
                <h2 className="admin-org-panel-title">Details</h2>
                <p className="admin-org-panel-copy">Name, category, and who can use it.</p>
              </div>
            </div>
            <div className="admin-org-form">
              <PanelFields labels={['Name', 'Industry', 'Category', 'Form type']} />
              <Sk h={90} r={10} />
              <Sk w={130} h={38} r="pill" />
            </div>
          </section>
        </div>
        <section className="admin-org-danger">
          <div>
            <h2 className="admin-org-panel-title">Delete template</h2>
            <p className="admin-org-panel-copy">This removes it from the gallery for everyone.</p>
          </div>
          <Sk w={150} h={38} r="pill" />
        </section>
      </div>
    </SkRegion>
  );
}

export function AdminTemplateBuilderSkeleton() {
  return (
    <SkRegion label="Loading template builder">
      <div className="template-builder-page">
        <header className="builder-header">
          <Sk w={190} h={36} r="pill" />
          <div className="builder-header-utility">
            <Sk w={92} h={32} r="pill" />
            <Sk w={92} h={32} r="pill" />
          </div>
        </header>
        <div className="builder">
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
      </div>
    </SkRegion>
  );
}
