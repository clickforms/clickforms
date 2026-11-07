import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { PromotionsAdminClient } from '@/app/admin/billing/promotions/promotions-admin-client';
import { authOptions } from '@/lib/auth';

export default async function AdminPromotionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    redirect('/forms');
  }
  return <PromotionsAdminClient />;
}
