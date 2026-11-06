import Link from 'next/link';
import { ErrorScreen } from '@/components/error-screen';

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Page not found"
      message="The page you're looking for doesn't exist or may have moved."
      actions={
        <Link href="/forms" className="error-screen-btn error-screen-btn--primary">
          Back to dashboard
        </Link>
      }
    />
  );
}
