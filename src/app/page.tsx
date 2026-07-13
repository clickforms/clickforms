import { getServerSession } from 'next-auth';
import { LandingPage } from '@/app/landing-page';
import { authOptions } from '@/lib/auth';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  return <LandingPage isAuthenticated={Boolean(session?.user)} />;
}
