import type { ReactNode } from 'react';

export type IconName = 'building' | 'user' | 'bell' | 'layout' | 'chart' | 'card';

const ICON_PATHS: Record<IconName, ReactNode> = {
  building: (
    <>
      <path d="M3.5 14V3.2c0-.4.3-.7.7-.7h5.6c.4 0 .7.3.7.7V14" />
      <path d="M10.5 6.5h1.8c.4 0 .7.3.7.7V14" />
      <path d="M2 14h12M6 5.5h1.5M6 8h1.5M6 10.5h1.5" />
    </>
  ),
  user: (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.4-2.4 2.3-3.8 5-3.8s4.6 1.4 5 3.8" />
    </>
  ),
  bell: (
    <>
      <path d="M4 11V7.2a4 4 0 0 1 8 0V11l1.2 1.5H2.8L4 11Z" />
      <path d="M6.5 14a1.6 1.6 0 0 0 3 0" />
    </>
  ),
  layout: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1.6" />
      <path d="M2 6h12M5.5 6v7.5" />
    </>
  ),
  chart: (
    <>
      <path d="M2.5 13.5h11" />
      <path d="M4.5 13V8.5M8 13V4M11.5 13V7" />
    </>
  ),
  card: (
    <>
      <rect x="1.8" y="3.5" width="12.4" height="9" rx="1.6" />
      <path d="M1.8 6.8h12.4M4 10h2.4" />
    </>
  ),
};

/** Small line icon used by panel headers and the section nav. */
export function OrgIcon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

interface PanelHeadProps {
  icon: IconName;
  title: string;
  description?: string;
  /** Optional trailing control (e.g. a help tip or an action). */
  aside?: ReactNode;
}

/** Header for an org settings panel: icon tile, title, one-line description. */
export function PanelHead({ icon, title, description, aside }: PanelHeadProps) {
  return (
    <header className="org-panel-head">
      <div className="org-panel-head-main">
        <span className="org-panel-icon" aria-hidden="true">
          <OrgIcon name={icon} />
        </span>
        <div>
          <h2 className="org-panel-title">{title}</h2>
          {description ? <p className="org-panel-lead">{description}</p> : null}
        </div>
      </div>
      {aside}
    </header>
  );
}
