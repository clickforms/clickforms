'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { type ReactNode, useState } from 'react';
import { SessionProvider } from '@/components/session-provider';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';

export type OrgAccessState = 'loading' | 'member' | 'blocked' | 'ready';

export function useJoinOrganisation(organizationId: string, organizationName: string) {
  const { data: sessionData, status, update } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [isJoining, setIsJoining] = useState(false);

  const actorOrganizationId = sessionData?.user?.organizationId ?? null;
  const access: OrgAccessState =
    status !== 'authenticated' || !sessionData?.user
      ? 'loading'
      : actorOrganizationId === organizationId
        ? 'member'
        : actorOrganizationId
          ? 'blocked'
          : 'ready';

  async function join() {
    setIsJoining(true);
    try {
      const res = await fetch(`/api/admin/organizations/${organizationId}/join`, {
        method: 'POST',
      });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not join this organisation'));
        return;
      }
      await update({ candidateOrganizationId: organizationId });
      toast.success(`Joined ${organizationName}`);
      router.push('/forms');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsJoining(false);
    }
  }

  return { access, isJoining, join };
}

export function JoinOrganisationSession({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
