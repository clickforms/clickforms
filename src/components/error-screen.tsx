import type { ReactNode } from 'react';
import './error-screen.css';

interface ErrorScreenProps {
  code?: string;
  title: string;
  message: string;
  reference?: string;
  actions: ReactNode;
}

/** Shared full-page state for errors and 404s: brand bar, illustration, headline, actions. */
export function ErrorScreen({ code, title, message, reference, actions }: ErrorScreenProps) {
  return (
    <div className="error-screen">
      <header className="error-screen-bar">
        {/* biome-ignore lint/performance/noImgElement: static brand asset, also used by global-error outside the app shell */}
        <img src="/brand/logo.svg" alt="Clickforms" height={28} />
      </header>
      <main className="error-screen-main">
        <div className="error-screen-art" aria-hidden="true">
          <svg viewBox="0 0 320 220" fill="none" aria-hidden="true">
            <ellipse cx="160" cy="200" rx="110" ry="10" fill="#e2e8f0" />
            <rect
              x="70"
              y="30"
              width="180"
              height="150"
              rx="14"
              fill="#fff"
              stroke="#cbd5e1"
              strokeWidth="2"
            />
            <rect x="70" y="30" width="180" height="30" rx="14" fill="#e9fdf1" />
            <rect x="70" y="46" width="180" height="14" fill="#e9fdf1" />
            <circle cx="88" cy="45" r="4" fill="#55ea8c" />
            <circle cx="102" cy="45" r="4" fill="#cbd5e1" />
            <circle cx="116" cy="45" r="4" fill="#cbd5e1" />
            <rect x="92" y="80" width="90" height="10" rx="5" fill="#e2e8f0" />
            <rect x="92" y="102" width="136" height="10" rx="5" fill="#f1f5f9" />
            <rect x="92" y="124" width="112" height="10" rx="5" fill="#f1f5f9" />
            <circle cx="236" cy="150" r="34" fill="#55ea8c" />
            <path d="M236 133v20" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" />
            <circle cx="236" cy="166" r="3.5" fill="#0f172a" />
          </svg>
        </div>
        {code ? <p className="error-screen-code">{code}</p> : null}
        <h1 className="error-screen-title">{title}</h1>
        <p className="error-screen-message">{message}</p>
        <div className="error-screen-actions">{actions}</div>
        {reference ? <p className="error-screen-ref">Error reference: {reference}</p> : null}
      </main>
    </div>
  );
}
