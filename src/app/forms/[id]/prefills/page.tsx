import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { PrefillsListClient } from '@/app/forms/[id]/prefills/prefills-list-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { listPrefills, prefillStatus } from '@/lib/forms/prefills';
import { prefillUrl } from '@/lib/forms/send-prefill-email';
import { requireOrganizationId } from '@/lib/session';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrefillsPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return null;

  const result = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id, organizationId: requireOrganizationId(session) },
    });
    if (!form) return null;
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: requireOrganizationId(session) },
      select: { subdomain: true },
    });
    return { form, rows: await listPrefills(tx, form.id), subdomain: organization.subdomain };
  });
  if (!result) notFound();

  const { form, rows, subdomain } = result;
  return (
    <div className="submissions-page">
      <div className="submissions-page-header">
        <p className="submissions-page-kicker">{form.name}</p>
        <h1 className="submissions-page-title">Prefills</h1>
        <p className="submissions-page-subtitle">
          Forms you&apos;ve sent with answers already filled in. Responses that come back appear
          under Responses, marked as prefilled.
        </p>
      </div>
      <PrefillsListClient
        formId={form.id}
        slug={form.slug}
        isLive={Boolean(form.currentVersionId)}
        initialPrefills={rows.map((row) => ({
          id: row.id,
          recipientEmail: row.recipient_email,
          recipientName: row.recipient_name,
          url: prefillUrl(subdomain, form.slug, row.token),
          status: prefillStatus(row),
          sentAt: (row.sent_at ?? row.created_at).toISOString(),
          createdBy: row.created_by_name,
          responses: row.completed,
        }))}
      />
    </div>
  );
}
