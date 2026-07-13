'use client';

import { useState } from 'react';
import { CreateFormModal } from '@/app/forms/create-form-modal';

interface DashboardStats {
  activeForms: number;
  totalResponses: number;
}

function ViewsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="8" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 17c1.5-3 4-4.5 7.5-4.5S16.5 14 18 17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ResponsesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 7.5l7 4 7-4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function ActiveFormsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="5" y="3.5" width="12" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <line
        x1="8"
        y1="8"
        x2="14"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="11.5"
        x2="14"
        y2="11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="15"
        x2="11.5"
        y2="15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DashboardClient({
  stats,
  formCount,
  canEdit,
}: {
  stats: DashboardStats;
  formCount: number;
  canEdit: boolean;
}) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="dashboard">
      <div className="dashboard-main">
        <div className="stats-row stats-row--dashboard">
          <div className="stat-card stat-card--icon">
            <div className="stat-card-icon stat-card-icon--teal">
              <ViewsIcon />
            </div>
            <div className="stat-card-body">
              <p className="stat-card-value">0</p>
              <p className="stat-card-label">Views</p>
            </div>
          </div>
          <div className="stat-card stat-card--icon">
            <div className="stat-card-icon stat-card-icon--blue">
              <ResponsesIcon />
            </div>
            <div className="stat-card-body">
              <p className="stat-card-value">{stats.totalResponses}</p>
              <p className="stat-card-label">Responses</p>
            </div>
          </div>
          <div className="stat-card stat-card--icon">
            <div className="stat-card-icon stat-card-icon--purple">
              <ActiveFormsIcon />
            </div>
            <div className="stat-card-body">
              <p className="stat-card-value">{stats.activeForms}</p>
              <p className="stat-card-label">Active forms</p>
            </div>
          </div>
        </div>

        {formCount === 0 ? (
          <div className="dashboard-empty card">
            <p className="dashboard-empty-text">You haven&apos;t created any forms yet!</p>
            {canEdit ? (
              <button
                type="button"
                className="button dashboard-create-button"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <span aria-hidden="true">+</span> Create Form
              </button>
            ) : null}
            <p className="dashboard-empty-footer">
              Got any questions? Want us to create a form for you?{' '}
              <a href="mailto:support@example.com">Send us an email</a> any time.
            </p>
          </div>
        ) : (
          <div className="dashboard-summary card">
            <p>
              You have <strong>{formCount}</strong> form{formCount === 1 ? '' : 's'}.{' '}
              <a href="/forms/list">View all forms →</a>
            </p>
            {canEdit ? (
              <button type="button" className="button" onClick={() => setIsCreateModalOpen(true)}>
                + Create Form
              </button>
            ) : null}
          </div>
        )}
      </div>

      {canEdit ? (
        <CreateFormModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      ) : null}
    </div>
  );
}
