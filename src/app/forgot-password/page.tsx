import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ForgotPasswordForm } from '@/app/forgot-password/forgot-password-form';
import { BrandMark } from '@/components/brand-mark';
import { authOptions } from '@/lib/auth';

export const metadata = {
  title: 'Reset your password — Clickforms',
  description: 'Request a password reset link for your Clickforms admin account.',
};

export default async function ForgotPasswordPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect('/forms');
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <Link href="/" className="login-brand">
          <BrandMark id="forgot-password" />
          <span>Clickforms</span>
        </Link>

        <div className="login-card">
          <div className="login-card-header">
            <h1>Reset your password</h1>
            <p>Enter your account email and we&apos;ll send you a link to reset your password.</p>
          </div>
          <ForgotPasswordForm />
        </div>

        <p className="login-meta">Internal forms platform · Admin access only</p>
      </div>
    </div>
  );
}
