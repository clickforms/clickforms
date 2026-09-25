import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { ReactNode } from 'react';
import { AdminShellClient } from '@/app/forms/admin-shell-client';
import { isTrialExpired } from '@/lib/admin/plan-limits';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { createPresignedDownloadUrl } from '@/lib/s3';
import { requireOrganizationId } from '@/lib/session';

export default async function FormsLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/forms')}`);
  }

  if (!session.user.organizationId) {
    redirect(session.user.isPlatformAdmin ? '/admin' : '/login');
  }

  const email = session.user.email ?? 'Signed in';
  // The session/JWT only carries id/organizationId/role (see types/next-auth.d.ts) — the
  // display name for the account menu's avatar comes from a direct lookup, same as the
  // dashboard's greeting (src/app/forms/page.tsx).
  const [user, organization] = await withOrgContext(session.user.organizationId, (tx) =>
    Promise.all([
      tx.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
      tx.organization.findUnique({
        where: { id: requireOrganizationId(session) },
        select: { name: true, logoStorageKey: true, status: true, trialEndsAt: true },
      }),
    ]),
  );

  // Checked on every /forms/* page load (this layout wraps all of them) rather than once
  // at sign-in — see src/lib/auth.ts's comment on why an expired trial no longer blocks
  // sign-in. The banner is the surface for it; write actions are separately blocked by
  // assertOrgActionsAllowed at the API layer regardless of whether this banner renders.
  const trialExpired = organization ? isTrialExpired(organization) : false;

  // Regenerated on every page load, never stored — see the identity header on
  // /forms/organisation (organisation-details-client.tsx) for how it's uploaded.
  let logoUrl: string | null = null;
  if (organization?.logoStorageKey) {
    try {
      logoUrl = await createPresignedDownloadUrl({
        storageKey: organization.logoStorageKey,
        filename: 'logo',
        inline: true,
      });
    } catch {
      // Soft-fail — a missing S3_BUCKET in local dev shouldn't break the whole
      // workspace shell, just the logo image (falls back to the default brand mark).
    }
  }

  return (
    <AdminShellClient
      email={email}
      name={user?.name ?? null}
      userRole={session.user.role}
      isPlatformAdmin={session.user.isPlatformAdmin}
      isTemporaryOrgJoin={session.user.isTemporaryOrgJoin}
      logoUrl={logoUrl}
      organizationName={organization?.name ?? 'Clickforms'}
      trialExpired={trialExpired}
    >
      {children}
    </AdminShellClient>
  );
}
