import type { ReactNode } from 'react';
import './error-screen.css';

interface ErrorScreenProps {
  code?: string;
  title: string;
  message: string;
  reference?: string;
  actions: ReactNode;
}

/** Shared full-page state for errors and 404s — one calm card on the site's green theme. */
export function ErrorScreen({ code, title, message, reference, actions }: ErrorScreenProps) {
  return (
    <main className="error-screen">
      <div className="error-screen-card">
        <div className="error-screen-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3.5 2.8 19.5h18.4L12 3.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M12 10v4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="currentColor" />
          </svg>
        </div>
        {code ? <p className="error-screen-code">{code}</p> : null}
        <h1 className="error-screen-title">{title}</h1>
        <p className="error-screen-message">{message}</p>
        <div className="error-screen-actions">{actions}</div>
        {reference ? <p className="error-screen-ref">Reference {reference}</p> : null}
      </div>
    </main>
  );
}
