import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { ReactNode } from 'react';
import { FormWorkspaceShell } from '@/app/forms/[id]/form-workspace-shell';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';

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

  const [form, responseCount] = await withOrgContext(session.user.organizationId, (tx) =>
    Promise.all([
      tx.form.findFirst({
        where: { id, organizationId: session.user.organizationId },
        select: { id: true, name: true, slug: true, status: true },
      }),
      // Mirrors the "responses" count used on the dashboard — submitted (and later
      // reviewed) submissions only, not abandoned in-progress ones.
      tx.submission.count({
        where: { formId: id, organizationId: session.user.organizationId, status: 'submitted' },
      }),
    ]),
  );

  if (!form) {
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
