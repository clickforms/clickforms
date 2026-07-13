import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { SignupForm } from '@/app/signup/signup-form';
import { BrandMark } from '@/components/brand-mark';
import { authOptions } from '@/lib/auth';

export const metadata = {
  title: 'Sign up — Clickforms',
  description: 'Create your organisation and start building forms.',
};

const BENEFITS = [
  {
    title: 'Build once, reuse everywhere',
    body: 'Drag-and-drop fields, conditional logic, and branded layouts.',
  },
  {
    title: 'Signatures that hold up',
    body: 'Collect consent with a clear audit trail on every submission.',
  },
  {
    title: 'Invite your team later',
    body: 'You start as admin — add colleagues when you are ready.',
  },
] as const;

export default async function SignupPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect('/forms');
  }

  return (
    <div className="signup-page">
      <div className="signup-layout">
        <aside className="signup-aside">
          <Link href="/" className="signup-aside-brand">
            <BrandMark id="signup-aside" size={36} />
            <span>Clickforms</span>
          </Link>

          <div className="signup-aside-copy">
            <h1 className="signup-aside-title">
              Your workspace for forms that actually get finished
            </h1>
            <p className="signup-aside-lead">
              Replace scattered PDFs and inbox chaos with structured intake, consent, and service
              agreements — ready for your team.
            </p>
          </div>

          <ul className="signup-aside-benefits">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title} className="signup-aside-benefit">
                <span className="signup-aside-benefit-mark" aria-hidden="true" />
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

        <section className="signup-panel" aria-labelledby="signup-panel-title">
          <div className="signup-panel-header">
            <p className="signup-panel-kicker">Get started</p>
            <h2 id="signup-panel-title">Create your organisation</h2>
            <p>
              Set up your workspace. You&apos;ll be the organisation admin and can invite teammates
              later.
            </p>
          </div>
          <SignupForm />
        </section>
      </div>
    </div>
  );
}
