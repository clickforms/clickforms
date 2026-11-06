'use client';

import { ErrorScreen } from '@/components/error-screen';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      title="Something went wrong"
      message="We hit an unexpected problem loading this page. Your data is safe. Try again, and if it keeps happening let us know."
      reference={error.digest}
      actions={
        <>
          <button
            type="button"
            className="error-screen-btn error-screen-btn--primary"
            onClick={reset}
          >
            Try again
          </button>
          <a href="/forms" className="error-screen-btn">
            Back to dashboard
          </a>
        </>
      }
    />
  );
}
