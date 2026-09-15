'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { SessionProvider } from '@/components/session-provider';
import { useToast } from '@/components/toast';
import { readApiError } from '@/lib/error-message';

/**
 * Shown across the org workspace whenever the signed-in user is a Clickforms platform
 * admin who used "Join this organisation" (src/app/admin/organisations/[id]/join-organisation-button.tsx)
 * rather than being a genuine employee of this organisation — the distinction the server
 * computes as `session.user.isTemporaryOrgJoin` (see isTemporaryOrgJoin() in
 * src/lib/auth.ts). Exists so platform staff can't lose track of the fact that they're
 * looking at a customer's real data in a testing/investigation capacity, and gives them a
 * one-click way out.
 */
function TemporaryOrgBannerInner() {
  const { data: sessionData, status, update } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [isLeaving, setIsLeaving] = useState(false);

  if (status !== 'authenticated' || !sessionData?.user?.isTemporaryOrgJoin) {
    return null;
  }

  async function handleLeave() {
    setIsLeaving(true);
    try {
      const res = await fetch('/api/me/leave-organization', { method: 'POST' });
      if (!res.ok) {
        toast.error(await readApiError(res, 'Could not leave this organisation'));
        return;
      }
      await update({ candidateOrganizationId: null });
      router.push('/admin');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLeaving(false);
    }
  }

  return (
    <div className="staff-view-chip" role="status">
      <span className="staff-view-chip-label">Staff view</span>
      <button
        type="button"
        className="staff-view-chip-exit"
        onClick={() => void handleLeave()}
        disabled={isLeaving}
      >
        {isLeaving ? 'Leaving…' : 'Back to Admin'}
      </button>
    </div>
  );
}

export function TemporaryOrgBanner() {
  return (
    <SessionProvider>
      <TemporaryOrgBannerInner />
    </SessionProvider>
  );
}
