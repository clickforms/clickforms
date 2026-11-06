import { type ReactNode, useId } from 'react';

/** Small ⓘ button that reveals a short explanation on hover or focus. */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="org-help">
      <button type="button" className="org-help-button" aria-describedby={id} aria-label={label}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 7.2v3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="5.2" r="0.7" fill="currentColor" />
        </svg>
      </button>
      <span id={id} role="tooltip" className="org-help-tooltip">
        {children}
      </span>
    </span>
  );
}
