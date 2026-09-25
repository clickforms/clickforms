import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { ReactNode } from 'react';
import { FormWorkspaceShell } from '@/app/forms/[id]/form-workspace-shell';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { requireOrganizationId } from '@/lib/session';
import { buildOrgFormUrl } from '@/lib/tenant';
import { canViewForm } from '@/lib/user-roles';

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function FormWorkspaceLayout({ children, params }: LayoutProps) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  // Sequential, not Promise.all — all queries share one connection via withOrgContext's
  // transaction, and concurrent queries on a single `pg` client are deprecated (and will
  // error in pg@9.0).
  const { form, responseCount, organization } = await withOrgContext(
    session.user.organizationId,
    async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: requireOrganizationId(session) },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdBy: true,
          isPrivate: true,
        },
      });
      // Mirrors the "responses" count used on the dashboard — submitted (and later
      // reviewed) submissions only, not abandoned in-progress ones.
      const responseCount = await tx.submission.count({
        where: { formId: id, organizationId: requireOrganizationId(session), status: 'submitted' },
      });
      // Needed to build the absolute /f/[slug] link for the top nav's Share button —
      // see src/app/forms/list/page.tsx for the same buildOrgFormUrl pattern.
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: requireOrganizationId(session) },
        select: { subdomain: true },
      });
      return { form, responseCount, organization };
    },
  );

  // A private form 404s for everyone but its creator — see canViewForm. This gates the
  // whole form workspace tree (builder, submissions, etc.), which all render as children
  // of this layout.
  if (!form || !canViewForm(form.isPrivate, form.createdBy, session.user.id)) {
    notFound();
  }

  const publicUrl = buildOrgFormUrl(organization.subdomain, `/f/${form.slug}`);
  // For the Share panel's "send via email/SMS" preview only — the actual send
  // (POST /api/forms/[id]/share) re-derives this from the session server-side rather
  // than trusting anything the client sends back, so a stale/mismatched value here
  // could only ever affect what the sender previews, never who a message claims to be
  // from.
  const senderName = session.user.name ?? session.user.email ?? 'You';

  return (
    <FormWorkspaceShell
      formId={form.id}
      formName={form.name}
      slug={form.slug}
      initialStatus={form.status}
      responseCount={responseCount}
      publicUrl={publicUrl}
      senderName={senderName}
    >
      {children}
    </FormWorkspaceShell>
  );
}
