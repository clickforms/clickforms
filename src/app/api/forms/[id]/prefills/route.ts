import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertOrgActionsAllowed } from '@/lib/admin/plan-enforcement';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { generatePrefillToken, PREFILL_TTL_MS, sanitizePrefillAnswers } from '@/lib/forms/prefills';
import { formSchemaSchema } from '@/lib/forms/schema';
import { prefillUrl, sendPrefillEmail } from '@/lib/forms/send-prefill-email';
import { requireOrganizationId, requireRole, requireSession, userDisplayName } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SEND_RATE_LIMIT = 30;
const SEND_RATE_WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  recipientEmail: z.string().trim().email('Enter a valid email address'),
  recipientName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Creates a prefill for a live form — the answers an admin filled in on /f/[slug]/prefill —
 * stores it, and emails the recipient their personal link. Answers are kept server-side; the
 * link carries only a random token.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const organizationId = requireOrganizationId(session);

    const created = await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({ where: { id, organizationId } });
      assertFormEditAccess(form, session.user.role, session.user.id);
      await assertOrgActionsAllowed(tx, organizationId);
      if (!form.currentVersionId) {
        throw new InvalidRequestError('Publish the form before sending a prefilled link.');
      }

      const version = await tx.formVersion.findFirst({
        where: { id: form.currentVersionId, organizationId },
      });
      const parsed = formSchemaSchema.safeParse(version?.schema);
      if (!parsed.success) throw new InvalidRequestError('The published form could not be read.');
      const answers = sanitizePrefillAnswers(parsed.data, body.answers);
      if (Object.keys(answers).length === 0) {
        throw new InvalidRequestError('Fill in at least one answer to prefill.');
      }

      const windowStart = new Date(Date.now() - SEND_RATE_WINDOW_MS);
      const recent = await tx.emailLog.count({
        where: { organizationId, kind: 'form_prefill', createdAt: { gte: windowStart } },
      });
      if (recent >= SEND_RATE_LIMIT) {
        throw new InvalidRequestError(
          "You've sent a lot of these recently — please wait a bit before sending more.",
        );
      }

      const token = generatePrefillToken();
      const expiresAt = new Date(Date.now() + PREFILL_TTL_MS);
      const rows = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO form_prefills
          (organization_id, form_id, created_by, recipient_email, recipient_name, token, answers, sent_at, expires_at)
        VALUES
          (${organizationId}::uuid, ${form.id}::uuid, ${session.user.id}::uuid, ${body.recipientEmail},
           ${body.recipientName || null}, ${token}, ${JSON.stringify(answers)}::jsonb, now(), ${expiresAt})
        RETURNING id`;

      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { subdomain: true },
      });
      const sender = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      });
      return {
        prefillId: rows[0]?.id,
        token,
        expiresAt,
        slug: form.slug,
        formName: form.name,
        subdomain: organization.subdomain,
        senderName: userDisplayName(sender?.name ?? session.user.name),
      };
    });

    const url = prefillUrl(created.subdomain, created.slug, created.token);
    await sendPrefillEmail({
      to: body.recipientEmail,
      recipientName: body.recipientName,
      senderName: created.senderName,
      formName: created.formName,
      url,
      note: body.note,
      expiresAt: created.expiresAt,
      organizationId,
    });

    return NextResponse.json({ id: created.prefillId, url }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
