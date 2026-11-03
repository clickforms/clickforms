import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { LandingPage } from '@/app/landing-page';
import { authOptions } from '@/lib/auth';
import { DEFAULT_KEYWORDS, pageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
  path: '/',
  title: 'Online Form Builder Australia | Custom Forms with E-Signatures | Clickforms',
  description:
    'Build custom online forms in minutes: intake, consent and service agreement forms with e-signatures, conditional logic and approvals. Australian-hosted. Free 7-day trial.',
  keywords: DEFAULT_KEYWORDS,
});

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  return <LandingPage isAuthenticated={Boolean(session?.user)} />;
}
