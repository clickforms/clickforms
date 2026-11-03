import { NextResponse } from 'next/server';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { prefillUrl, sendPrefillEmail } from '@/lib/forms/send-prefill-email';
import { requireOrganizationId, requireRole, requireSession, userDisplayName } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; prefillId: string }>;
}

/** Re-sends the same prefill link to its recipient (e.g. it went to spam). */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id, prefillId } = await params;
    const organizationId = requireOrganizationId(session);

    const data = await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({ where: { id, organizationId } });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const rows = await tx.$queryRaw<
        {
          token: string;
          recipient_email: string;
          recipient_name: string | null;
          expires_at: Date;
        }[]
      >`SELECT token, recipient_email, recipient_name, expires_at FROM form_prefills
        WHERE id = ${prefillId}::uuid AND form_id = ${form.id}::uuid`;
      const prefill = rows[0];
      if (!prefill) throw new NotFoundError('Prefill');
      if (prefill.expires_at.getTime() < Date.now()) {
        throw new InvalidRequestError('This prefill has expired. Create a new one.');
      }

      await tx.$executeRaw`UPDATE form_prefills SET sent_at = now() WHERE id = ${prefillId}::uuid`;
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { subdomain: true },
      });
      const sender = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      });
      return {
        prefill,
        form,
        subdomain: organization.subdomain,
        senderName: userDisplayName(sender?.name ?? session.user.name),
      };
    });

    await sendPrefillEmail({
      to: data.prefill.recipient_email,
      recipientName: data.prefill.recipient_name,
      senderName: data.senderName,
      formName: data.form.name,
      url: prefillUrl(data.subdomain, data.form.slug, data.prefill.token),
      expiresAt: data.prefill.expires_at,
      organizationId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
