import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { NewOrganisationClient } from '@/app/admin/organisations/new/new-organisation-client';
import { authOptions } from '@/lib/auth';

export default async function NewOrganisationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }

  return <NewOrganisationClient />;
}
