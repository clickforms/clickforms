import { getServerSession } from 'next-auth';
import type { ReactNode } from 'react';
import { SettingsShell } from '@/app/forms/settings/settings-nav';
import { authOptions } from '@/lib/auth';
import { canManageUsers } from '@/lib/user-roles';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const showOrganizationGroup = session?.user ? canManageUsers(session.user.role) : false;

  return <SettingsShell showOrganizationGroup={showOrganizationGroup}>{children}</SettingsShell>;
}
