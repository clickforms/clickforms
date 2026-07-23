'use client';

import type { FormStatus } from '@prisma/client';
import Link from 'next/link';
import { useState } from 'react';
import { CreateFormModal } from '@/app/forms/create-form-modal';
import { LiveStatusBadge } from '@/components/live-status-badge';

interface DashboardStats {
  liveForms: number;
  draftForms: number;
  totalResponses: number;
  formCount: number;
}

interface RecentForm {
  id: string;
  name: string;
  status: FormStatus;
  updatedAt: string;
  responseCount: number;
  isLive: boolean;
  hasPendingChanges: boolean;
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
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'F';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0]!}${words[1]![0]!}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function LiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="2.25" fill="currentColor" />
    </svg>
  );
}

function ResponsesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect
        x="3.25"
        y="4.25"
        width="11.5"
        height="9.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.5 6.5l5.5 3.25L14.5 6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DraftsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect
        x="4.25"
        y="2.75"
        width="9.5"
        height="12.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6.75 6.5h4.5M6.75 9h4.5M6.75 11.5h2.75"
        stroke="currentColor"
        strokeWidth="1.4"
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
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.5 7h9M7.5 3.5L11 7l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardClient({
  displayName,
  stats,
  recentForms,
  canEdit,
}: {
  displayName: string;
  stats: DashboardStats;
  recentForms: RecentForm[];
  canEdit: boolean;
}) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const isEmpty = stats.formCount === 0;

  return (
    <div className="dashboard">
      <div className="dashboard-glow" aria-hidden="true" />

      <header className="dashboard-header dashboard-in dashboard-in--1">
        <div className="dashboard-header-copy">
          <p className="dashboard-kicker">{formatTodayLabel(now)}</p>
          <h2 className="dashboard-greeting">
            {greeting}, {firstName}
          </h2>
          <p className="dashboard-lede">
            {isEmpty
              ? 'Create your first form and publish it to your organisation subdomain.'
              : 'Overview of what is live, what is collecting responses, and what still needs work.'}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <Link href="/forms/list" className="button button--ghost dashboard-secondary">
            All forms
          </Link>
          {canEdit ? (
            <button
              type="button"
              className="button dashboard-primary"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <PlusIcon /> New form
            </button>
          ) : null}
        </div>
      </header>

      <section className="dashboard-metrics dashboard-in dashboard-in--2" aria-label="Overview">
        <article className="dashboard-metric">
          <div className="dashboard-metric-top">
            <span className="dashboard-metric-icon dashboard-metric-icon--live">
              <LiveIcon />
            </span>
            <span className="dashboard-metric-label">Live forms</span>
          </div>
          <p className="dashboard-metric-value dashboard-metric-value--live">{stats.liveForms}</p>
        </article>
        <article className="dashboard-metric">
          <div className="dashboard-metric-top">
            <span className="dashboard-metric-icon dashboard-metric-icon--responses">
              <ResponsesIcon />
            </span>
            <span className="dashboard-metric-label">Responses</span>
          </div>
          <p className="dashboard-metric-value">{stats.totalResponses}</p>
        </article>
        <article className="dashboard-metric">
          <div className="dashboard-metric-top">
            <span className="dashboard-metric-icon dashboard-metric-icon--drafts">
              <DraftsIcon />
            </span>
            <span className="dashboard-metric-label">Drafts</span>
          </div>
          <p className="dashboard-metric-value">{stats.draftForms}</p>
        </article>
      </section>

      {isEmpty ? (
        <section className="dashboard-panel dashboard-empty dashboard-in dashboard-in--3">
          <div className="dashboard-empty-mark" aria-hidden="true">
            <DraftsIcon />
          </div>
          <div className="dashboard-empty-copy">
            <h3 className="dashboard-empty-title">No forms yet</h3>
            <p className="dashboard-empty-text">
              Start with a blank form, shape the fields your team needs, then publish when it is
              ready for respondents.
            </p>
            {canEdit ? (
              <button type="button" className="button" onClick={() => setIsCreateModalOpen(true)}>
                <PlusIcon /> Create form
              </button>
            ) : (
              <p className="dashboard-empty-hint">Ask an editor to create one for you.</p>
            )}
          </div>
        </section>
      ) : (
        <section
          className="dashboard-panel dashboard-in dashboard-in--3"
          aria-labelledby="dashboard-recent-heading"
        >
          <div className="dashboard-panel-header">
            <div>
              <h3 id="dashboard-recent-heading" className="dashboard-panel-title">
                Recent forms
              </h3>
              <p className="dashboard-panel-subtitle">Jump back into what you last edited</p>
            </div>
            <Link href="/forms/list" className="dashboard-panel-link">
              View all <ArrowIcon />
            </Link>
          </div>
          <ul className="dashboard-recent">
            {recentForms.map((form) => (
              <li key={form.id}>
                <Link href={`/forms/${form.id}/builder`} className="dashboard-recent-row">
                  <span className="dashboard-recent-mark" aria-hidden="true">
                    {formInitial(form.name)}
                  </span>
                  <div className="dashboard-recent-copy">
                    <span className="dashboard-recent-name">{form.name}</span>
                    <span className="dashboard-recent-meta">
                      {form.responseCount} response{form.responseCount === 1 ? '' : 's'}
                      <span className="dashboard-recent-sep" aria-hidden="true">
                        ·
                      </span>
                      <time dateTime={form.updatedAt}>{formatRelativeTime(form.updatedAt)}</time>
                    </span>
                  </div>
                  <LiveStatusBadge
                    status={form.status}
                    isLive={form.isLive}
                    hasPendingChanges={form.hasPendingChanges}
                  />
                  <span className="dashboard-recent-arrow" aria-hidden="true">
                    <ArrowIcon />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canEdit ? (
        <CreateFormModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      ) : null}
    </div>
  );
}
