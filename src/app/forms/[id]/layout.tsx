import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { ReactNode } from 'react';
import { FormWorkspaceShell } from '@/app/forms/[id]/form-workspace-shell';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
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

  // Sequential, not Promise.all — both queries share one connection via withOrgContext's
  // transaction, and concurrent queries on a single `pg` client are deprecated (and will
  // error in pg@9.0).
  const { form, responseCount } = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id, organizationId: session.user.organizationId },
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
      where: { formId: id, organizationId: session.user.organizationId, status: 'submitted' },
    });
    return { form, responseCount };
  });

  // A private form 404s for everyone but its creator — see canViewForm. This gates the
  // whole form workspace tree (builder, submissions, etc.), which all render as children
  // of this layout.
  if (!form || !canViewForm(form.isPrivate, form.createdBy, session.user.id)) {
    notFound();
  }

  return (
    <FormWorkspaceShell
      formId={form.id}
      formName={form.name}
      slug={form.slug}
      initialStatus={form.status}
      responseCount={responseCount}
    >
      {children}
    </FormWorkspaceShell>
  );
}
