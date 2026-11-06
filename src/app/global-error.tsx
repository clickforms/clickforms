'use client';

import { ErrorScreen } from '@/components/error-screen';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-AU">
      <body style={{ margin: 0 }}>
        <ErrorScreen
          title="Something went wrong"
          message="Clickforms couldn't load this page. Your data is safe. Reload to try again."
          reference={error.digest}
          actions={
            <button
              type="button"
              className="error-screen-btn error-screen-btn--primary"
              onClick={reset}
            >
              Reload
            </button>
          }
        />
      </body>
    </html>
  );
}
