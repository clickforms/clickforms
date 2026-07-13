import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { ResetPasswordForm } from '@/app/reset-password/[token]/reset-password-form';
import { BrandMark } from '@/components/brand-mark';
import { authOptions } from '@/lib/auth';

export const metadata = {
  title: 'Reset your password — Clickforms',
};

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params;

  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect('/forms');
  }

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-shell">
          <div className="login-card">
            <p className="login-form-error">Missing reset token.</p>
            <p className="login-form-footer">
              <Link href="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <Link href="/" className="login-brand">
          <BrandMark id="reset-password" />
          <span>Clickforms</span>
        </Link>

        <div className="login-card">
          <div className="login-card-header">
            <h1>Choose a new password</h1>
            <p>Set a new password for your account.</p>
          </div>
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </div>
  );
}
