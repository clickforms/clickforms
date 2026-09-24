'use client';

import type { ReactNode } from 'react';

// Tabs at the top of the builder's left panel — Fields / Design / Logic —
// letting an admin jump straight to branding or a field's conditional logic without
// digging through nested settings groups. Purely a tab switcher: it renders no panel
// content itself, just the three buttons; builder-client.tsx swaps what shows below
// based on which tab is active.

export type BuilderRailTab = 'fields' | 'design' | 'logic';

function FieldsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M11 2.5L15.5 10H6.5L11 2.5Z" fill="currentColor" />
      <circle cx="6" cy="16" r="3" fill="currentColor" />
      <circle cx="14.5" cy="16.5" r="2.3" fill="currentColor" />
    </svg>
  );
}

function DesignIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 3.2c-4.3 0-7.8 3.4-7.8 7.6 0 3.5 2.6 5.1 4.6 5.1.8 0 1.2-.4 1.2-1 0-.5-.35-.8-.35-1.6 0-.9.75-1.6 1.7-1.6h1.9c2.9 0 5.2-2.2 5.2-5A6.9 6.9 0 0 0 11 3.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8.3" cy="8.6" r="1" fill="currentColor" />
      <circle cx="11.6" cy="6.9" r="1" fill="currentColor" />
      <circle cx="14.4" cy="9.3" r="1" fill="currentColor" />
      <circle cx="7.3" cy="12.4" r="1" fill="currentColor" />
    </svg>
  );
}

function LogicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M3 6.5h4.2c1 0 1.9.5 2.4 1.4l2.8 4.8c.5.9 1.4 1.4 2.4 1.4H19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M3 15.5h4.2c1 0 1.9-.5 2.4-1.4l.55-.95"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M15.8 3.8l3.2 2.7-3.2 2.7M15.8 18.2l3.2-2.7-3.2-2.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const RAIL_TABS: { id: BuilderRailTab; label: string; icon: () => ReactNode }[] = [
  { id: 'fields', label: 'Fields', icon: FieldsIcon },
  { id: 'design', label: 'Design', icon: DesignIcon },
  { id: 'logic', label: 'Logic', icon: LogicIcon },
];

export function BuilderRail({
  activeTab,
  onChangeTab,
}: {
  activeTab: BuilderRailTab;
  onChangeTab: (tab: BuilderRailTab) => void;
}) {
  return (
    <nav className="builder-rail" aria-label="Builder panels">
      {RAIL_TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`builder-rail-tab ${activeTab === id ? 'builder-rail-tab--active' : ''}`}
          onClick={() => onChangeTab(id)}
          aria-pressed={activeTab === id}
        >
          <span className="builder-rail-tab-icon">
            <Icon />
          </span>
          <span className="builder-rail-tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
