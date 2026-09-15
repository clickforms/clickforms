import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AcceptTeamInviteForm } from '@/app/team/accept/accept-team-invite-form';
import { BrandMark } from '@/components/brand-mark';
import { authOptions } from '@/lib/auth';

export const metadata = {
  title: 'Join Clickforms Admin',
};

interface AcceptTeamInvitePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptTeamInvitePage({ searchParams }: AcceptTeamInvitePageProps) {
  const params = await searchParams;
  const token = params.token?.trim();

  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(session.user.isPlatformAdmin ? '/admin' : '/forms');
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
          <BrandMark id="accept-team-invite" />
          <span>Clickforms</span>
        </Link>

        <div className="login-card">
          <div className="login-card-header">
            <h1>Join Clickforms Admin</h1>
            <p>Set your password to finish creating your platform-staff account.</p>
          </div>
          <AcceptTeamInviteForm token={token} />
        </div>
      </div>
    </div>
  );
}
