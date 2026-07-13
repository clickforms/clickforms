import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { LoginForm } from '@/app/login/login-form';
import { BrandMark } from '@/components/brand-mark';
import { authOptions } from '@/lib/auth';

export const metadata = {
  title: 'Sign in — Clickforms',
  description: 'Sign in to the Clickforms admin workspace.',
};

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? '/forms';
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <div className="login-page">
      <div className="login-page-bg" aria-hidden="true">
        <div className="login-page-mesh" />
        <div className="login-page-grid" />
      </div>

      <div className="login-shell">
        <Link href="/" className="login-brand">
          <BrandMark id="login" />
          <span>Clickforms</span>
        </Link>

        <div className="login-card">
          <div className="login-card-header">
            <h1>Sign in to admin</h1>
            <p>Use your organisation email and password to access the forms workspace.</p>
          </div>
          <LoginForm callbackUrl={callbackUrl} initialError={params.error} />
        </div>

        <p className="login-meta">Internal forms platform · Admin access only</p>
      </div>
    </div>
  );
}
