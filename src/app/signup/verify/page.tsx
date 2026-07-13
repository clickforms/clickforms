import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { SignupVerifyForm } from '@/app/signup/verify/signup-verify-form';
import { BrandMark } from '@/components/brand-mark';
import { authOptions } from '@/lib/auth';

export const metadata = {
  title: 'Verify your email — Clickforms',
};

interface SignupVerifyPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function SignupVerifyPage({ searchParams }: SignupVerifyPageProps) {
  const params = await searchParams;
  const token = params.token?.trim();

  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect('/forms');
  }

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-shell">
          <div className="login-card">
            <p className="login-form-error">Missing verification token.</p>
            <p className="login-form-footer">
              <Link href="/signup">Back to signup</Link>
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
          <BrandMark id="signup-verify" />
          <span>Clickforms</span>
        </Link>

        <div className="login-card">
          <div className="login-card-header">
            <h1>Set your password</h1>
            <p>Your email is verified — choose a password to finish setting up your workspace.</p>
          </div>
          <SignupVerifyForm token={token} />
        </div>
      </div>
    </div>
  );
}
