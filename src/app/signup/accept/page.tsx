import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AcceptInviteForm } from '@/app/signup/accept/accept-invite-form';
import { BrandMark } from '@/components/brand-mark';
import { authOptions } from '@/lib/auth';

export const metadata = {
  title: 'Accept invite — Clickforms',
};

interface AcceptInvitePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
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
            <p className="login-form-error">Missing invite token.</p>
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
          <BrandMark id="accept-invite" />
          <span>Clickforms</span>
        </Link>

        <div className="login-card">
          <div className="login-card-header">
            <h1>Join your team</h1>
            <p>Set your password to finish creating your account.</p>
          </div>
          <AcceptInviteForm token={token} />
        </div>
      </div>
    </div>
  );
}
