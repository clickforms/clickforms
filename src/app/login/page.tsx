import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { LoginForm } from '@/app/login/login-form';
import { BrandMark } from '@/components/brand-mark';
import { authOptions } from '@/lib/auth';
import { isPlatformOnlyAdmin } from '@/lib/session';

export const metadata = {
  title: 'Sign in — Clickforms',
  description: 'Sign in to the Clickforms admin workspace.',
};

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.5l2.5 2.5 5.5-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const BENEFITS = [
  {
    title: 'Pick up where you left off',
    body: 'Your forms, folders, and responses are exactly as you left them.',
  },
  {
    title: 'Your team, your data',
    body: "Only people you've invited can access your organisation.",
  },
  {
    title: 'Always backed up',
    body: 'Every submission is safely stored with a full audit trail.',
  },
] as const;

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? '/forms';
  const session = await getServerSession(authOptions);

  if (session?.user) {
    if (isPlatformOnlyAdmin(session) && !callbackUrl.startsWith('/admin')) {
      redirect('/admin');
    }
    redirect(callbackUrl);
  }

  return (
    <div className="signup-page">
      <div className="signup-card landing-anim landing-anim--1">
        <aside className="signup-aside">
          <Link href="/" className="signup-aside-brand">
            <BrandMark id="login-aside" size={32} variant="onColor" />
            <span>Clickforms</span>
          </Link>

          <div className="signup-aside-copy">
            <h1 className="signup-aside-title">Welcome back to your workspace</h1>
            <p className="signup-aside-lead">
              Sign in to manage your forms, responses, and team — everything&apos;s exactly where
              you left it.
            </p>
          </div>

          <ul className="signup-aside-benefits">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title} className="signup-aside-benefit">
                <span className="signup-aside-benefit-mark" aria-hidden="true">
                  <CheckIcon />
                </span>
                <div>
                  <strong>{benefit.title}</strong>
                  <span>{benefit.body}</span>
                </div>
              </li>
            ))}
          </ul>

          <p className="signup-aside-footnote">
            <Link href="/">← Back to home</Link>
          </p>
        </aside>

        <section className="signup-panel" aria-labelledby="login-panel-title">
          <div className="signup-panel-header">
            <p className="signup-panel-kicker">Sign in</p>
            <h2 id="login-panel-title">Sign in to admin</h2>
            <p>Use your email and password to access Clickforms.</p>
          </div>
          <LoginForm callbackUrl={callbackUrl} initialError={params.error} />
        </section>
      </div>
    </div>
  );
}
