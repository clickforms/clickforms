'use client';

import Link from 'next/link';

interface AdminHomeStats {
  organizationCount: number;
  userCount: number;
  formCount: number;
  submissionCountThisMonth: number;
}

interface RecentOrganization {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  userCount: number;
  formCount: number;
}

export interface RecentAdminActivity {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  organizationName: string | null;
  actorName: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  organization_create: 'Created organisation',
  organization_update: 'Updated organisation',
  organization_delete: 'Deleted organisation',
  joined_organization: 'Joined organisation',
  left_organization: 'Left organisation',
  logo_update: 'Updated logo',
  logo_remove: 'Removed logo',
  invite_accept: 'Accepted invite',
  invite: 'Sent invite',
  user_invite: 'Invited user',
  user_create: 'Created user',
  user_update: 'Updated user',
  user_remove: 'Removed user',
  update: 'Updated organisation',
  details_update: 'Updated details',
};

function formatAction(action: string): string {
  const verb = action.split('.').pop() ?? action;
  if (ACTION_LABELS[verb]) return ACTION_LABELS[verb];
  const words = verb.split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTodayLabel(date: Date): string {
  return date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function orgInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'O';
  const words = trimmed.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? 'O';
  const second = words.length >= 2 ? (words[1]?.[0] ?? '') : (words[0]?.[1] ?? '');
  return `${first}${second}`.toUpperCase();
}

function actorInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'S';
  return trimmed.slice(0, 1).toUpperCase();
}

function OrgsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3.5 14.5V6.8L9 3.5l5.5 3.3v7.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7 14.5v-4h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="7" cy="6" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.2 13.5c.4-2.1 2-3.3 3.8-3.3s3.4 1.2 3.8 3.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12.4" cy="6.6" r="1.7" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M12.2 10.4c1.5.2 2.6 1.2 2.9 2.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FormsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="2.75"
        width="10"
        height="12.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 6.5h4M7 9h4M7 11.5h2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ResponsesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3.5 5.5h11M3.5 9h11M3.5 12.5h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8h9M8.5 4.5 12.5 8l-4 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminHomeClient({
  displayName,
  stats,
  recentOrganizations,
  recentActivity,
}: {
  displayName: string;
  stats: AdminHomeStats;
  recentOrganizations: RecentOrganization[];
  recentActivity: RecentAdminActivity[];
}) {
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const isEmpty = stats.organizationCount === 0;

  const statCards = [
    {
      key: 'orgs',
      label: 'Organisations',
      value: stats.organizationCount,
      href: '/admin/organisations',
      icon: <OrgsIcon />,
    },
    {
      key: 'users',
      label: 'Users',
      value: stats.userCount,
      href: '/admin/users',
      icon: <UsersIcon />,
    },
    {
      key: 'forms',
      label: 'Forms',
      value: stats.formCount,
      href: '/admin/organisations',
      icon: <FormsIcon />,
    },
    {
      key: 'submissions',
      label: 'Responses',
      hint: 'This month',
      value: stats.submissionCountThisMonth,
      href: '/admin/organisations',
      icon: <ResponsesIcon />,
    },
  ] as const;

  return (
    <div className="admin-home">
      <header className="admin-home-header">
        <div className="admin-home-heading">
          <h1 className="admin-home-title">
            {greeting}, {firstName}
          </h1>
          <p className="admin-home-kicker">{formatTodayLabel(now)}</p>
        </div>
        <Link href="/admin/organisations/new" className="button button--dark">
          <PlusIcon /> New organisation
        </Link>
      </header>

      <section className="admin-home-stats" aria-label="Platform totals">
        {statCards.map((card) => (
          <Link key={card.key} href={card.href} className="admin-home-stat">
            <span className="admin-home-stat-icon" aria-hidden="true">
              {card.icon}
            </span>
            <span className="admin-home-stat-copy">
              <span className="admin-home-stat-value">{card.value}</span>
              <span className="admin-home-stat-label">
                {card.label}
                {'hint' in card && card.hint ? (
                  <span className="admin-home-stat-hint"> · {card.hint}</span>
                ) : null}
              </span>
            </span>
          </Link>
        ))}
      </section>

      {isEmpty ? (
        <section className="admin-home-empty">
          <div className="admin-home-empty-mark" aria-hidden="true">
            <OrgsIcon />
          </div>
          <div>
            <h2 className="admin-home-empty-title">No organisations yet</h2>
            <p className="admin-home-empty-copy">
              Create the first customer organisation and invite its admin to set a password.
            </p>
            <Link href="/admin/organisations/new" className="button button--dark">
              <PlusIcon /> New organisation
            </Link>
          </div>
        </section>
      ) : (
        <div className="admin-home-columns">
          <section className="admin-home-panel" aria-labelledby="admin-recent-orgs-heading">
            <div className="admin-home-panel-header">
              <h2 id="admin-recent-orgs-heading" className="admin-home-panel-title">
                Recent organisations
              </h2>
              <Link href="/admin/organisations" className="admin-home-panel-link">
                View all
                <ArrowIcon />
              </Link>
            </div>
            <ul className="admin-home-org-list">
              {recentOrganizations.map((org) => (
                <li key={org.id}>
                  <Link href={`/admin/organisations/${org.id}`} className="admin-home-org">
                    <span className="admin-home-org-mark" aria-hidden="true">
                      {orgInitial(org.name)}
                    </span>
                    <span className="admin-home-org-copy">
                      <span className="admin-home-org-name">{org.name}</span>
                      <span className="admin-home-org-meta">
                        {org.userCount} {org.userCount === 1 ? 'user' : 'users'}
                        {' · '}
                        {org.formCount} {org.formCount === 1 ? 'form' : 'forms'}
                      </span>
                    </span>
                    <time className="admin-home-org-time" dateTime={org.createdAt}>
                      {formatRelativeTime(org.createdAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-home-panel" aria-labelledby="admin-recent-activity-heading">
            <div className="admin-home-panel-header">
              <h2 id="admin-recent-activity-heading" className="admin-home-panel-title">
                Activity
              </h2>
              <Link href="/admin/audit-log" className="admin-home-panel-link">
                Audit log
                <ArrowIcon />
              </Link>
            </div>
            {recentActivity.length === 0 ? (
              <p className="admin-home-panel-empty">No activity logged yet.</p>
            ) : (
              <ul className="admin-home-activity">
                {recentActivity.map((entry) => {
                  const actor = entry.actorName ?? 'System';
                  return (
                    <li key={entry.id} className="admin-home-activity-row">
                      <span className="admin-home-activity-avatar" aria-hidden="true">
                        {actorInitial(actor)}
                      </span>
                      <span className="admin-home-activity-copy">
                        <span className="admin-home-activity-action">
                          {formatAction(entry.action)}
                        </span>
                        <span className="admin-home-activity-meta">
                          {actor}
                          {entry.organizationName ? ` · ${entry.organizationName}` : ''}
                        </span>
                      </span>
                      <time className="admin-home-activity-time" dateTime={entry.createdAt}>
                        {formatRelativeTime(entry.createdAt)}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
