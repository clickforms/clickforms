import type { ReactNode } from 'react';
import './form-notice.css';

type Tone = 'neutral' | 'success';

/** Full-page message for a public form link that can't show a form right now (offline,
 * removed, already submitted…). Used instead of a bare 404 so a respondent always gets a
 * calm explanation and a next step. */
export function FormNotice({
  title,
  children,
  tone = 'neutral',
}: {
  title: string;
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <main className="form-notice">
      <div className="form-notice-card">
        <div className={`form-notice-icon form-notice-icon--${tone}`} aria-hidden="true">
          {tone === 'success' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <title>Done</title>
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <title>Form</title>
              <rect
                x="5"
                y="3.5"
                width="14"
                height="17"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M8.5 9h7M8.5 12.5h7M8.5 16h4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
        <h1 className="form-notice-title">{title}</h1>
        <div className="form-notice-body">{children}</div>
      </div>
    </main>
  );
}
