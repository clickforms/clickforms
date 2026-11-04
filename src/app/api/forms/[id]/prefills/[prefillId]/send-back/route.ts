import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertOrgActionsAllowed } from '@/lib/admin/plan-enforcement';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { generatePrefillToken, PREFILL_TTL_MS, sanitizePrefillAnswers } from '@/lib/forms/prefills';
import { formSchemaSchema } from '@/lib/forms/schema';
import { prefillUrl, sendPrefillEmail } from '@/lib/forms/send-prefill-email';
import { requireOrganizationId, requireRole, requireSession, userDisplayName } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; prefillId: string }>;
}

const bodySchema = z.object({
  submissionId: z.string().uuid(),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Sends a returned (held) response back to the person who filled it in so they can correct it.
 * It becomes a new prefill — their own answers pre-filled, a fresh link — linked to the original
 * prefill via parent_id, so the whole exchange stays together under that prefill. The returned
 * response is kept as a record and marked as sent back.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id, prefillId } = await params;
    const body = bodySchema.parse(await request.json());
    const organizationId = requireOrganizationId(session);

    const result = await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({ where: { id, organizationId } });
      assertFormEditAccess(form, session.user.role, session.user.id);
      await assertOrgActionsAllowed(tx, organizationId);

      const parents = await tx.$queryRaw<
        {
          id: string;
          parent_id: string | null;
          recipient_email: string | null;
          recipient_name: string | null;
        }[]
      >`SELECT id, parent_id, recipient_email, recipient_name FROM form_prefills
        WHERE id = ${prefillId}::uuid AND form_id = ${form.id}::uuid AND NOT is_draft`;
      const parent = parents[0];
      if (!parent) throw new NotFoundError('Prefill');

      const subs = await tx.$queryRaw<
        { id: string; answers: Record<string, unknown>; form_version_id: string }[]
      >`SELECT id, answers, form_version_id FROM submissions
        WHERE id = ${body.submissionId}::uuid AND prefill_id = ${prefillId}::uuid AND prefill_held`;
      const sub = subs[0];
      if (!sub) throw new InvalidRequestError('That response is not waiting for review.');

      const version = await tx.formVersion.findFirst({ where: { id: sub.form_version_id } });
      const parsed = formSchemaSchema.safeParse(version?.schema);
      if (!parsed.success) throw new InvalidRequestError('The form could not be read.');
      const answers = sanitizePrefillAnswers(parsed.data, sub.answers);

      const rootId = parent.parent_id ?? parent.id;
      const token = generatePrefillToken();
      const expiresAt = new Date(Date.now() + PREFILL_TTL_MS);
      const rows = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO form_prefills
          (organization_id, form_id, created_by, recipient_email, recipient_name, token, answers,
           sent_at, expires_at, parent_id)
        VALUES
          (${organizationId}::uuid, ${form.id}::uuid, ${session.user.id}::uuid,
           ${parent.recipient_email}, ${parent.recipient_name}, ${token},
           ${JSON.stringify(answers)}::jsonb, ${parent.recipient_email ? new Date() : null},
           ${expiresAt}, ${rootId}::uuid)
        RETURNING id`;
      await tx.$executeRaw`UPDATE submissions SET sent_back_at = now() WHERE id = ${sub.id}::uuid`;

      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { subdomain: true },
      });
      const sender = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      });
      return {
        newId: rows[0]?.id ?? null,
        email: parent.recipient_email,
        recipientName: parent.recipient_name,
        url: prefillUrl(organization.subdomain, form.slug, token),
        formName: form.name,
        expiresAt,
        senderName: userDisplayName(sender?.name ?? session.user.name),
      };
    });

    if (result.email) {
      await sendPrefillEmail({
        to: result.email,
        recipientName: result.recipientName,
        senderName: result.senderName,
        formName: result.formName,
        url: result.url,
        note: body.note,
        expiresAt: result.expiresAt,
        organizationId,
        correction: true,
      });
    }

    return NextResponse.json(
      { id: result.newId, url: result.url, emailed: Boolean(result.email) },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
