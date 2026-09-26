import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertOrgActionsAllowed } from '@/lib/admin/plan-enforcement';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { formShareEmail } from '@/lib/emails/templates';
import { assertFormViewAccess } from '@/lib/form-access';
import { requireOrganizationId, requireRole, requireSession, userDisplayName } from '@/lib/session';
import { sendSms } from '@/lib/sms';
import { formShareSms } from '@/lib/sms-templates';
import { buildOrgFormUrl } from '@/lib/tenant';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Same window/cap used for both channels — a builder legitimately sharing one form
// with a handful of respondents never gets near this; it's here purely so an
// authenticated-but-malicious account can't turn this into a spam relay through
// Clickforms' own email/SMS sender identity. Counts EmailLog+SmsLog rows directly
// rather than adding new rate-limit infra, since neither table existed for this
// reason before and a dedicated rate-limiter would be overkill for one low-traffic
// action.
const SHARE_RATE_LIMIT = 20;
const SHARE_RATE_WINDOW_MS = 60 * 60 * 1000;

const shareBodySchema = z.discriminatedUnion('channel', [
  z.object({
    channel: z.literal('email'),
    recipient: z.string().trim().email('Enter a valid email address'),
    // Email uses the restricted rich-text editor; the template sanitizes its HTML again
    // server-side before rendering it.
    message: z.string().trim().max(50_000).optional(),
  }),
  z.object({
    channel: z.literal('sms'),
    // Loosely E.164-shaped: optional leading +, 8-15 digits. Real-world validation
    // (carrier-level deliverability) happens at MessageMedia, not here — this just
    // catches "that's not a phone number" typos before spending a send attempt.
    recipient: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid phone number, e.g. +61491570156'),
    message: z.string().trim().max(2000).optional(),
  }),
]);

/**
 * "Send via email/SMS" action in the live-form Share panel (src/app/forms/[id]/form-share-modal.tsx)
 * — lets a builder push the public form link directly to a respondent's inbox or phone,
 * rather than only copy/pasting the link themselves. Sender name is always the calling
 * session's own name, never taken from the request body, so this can't be used to send
 * a message that claims to be from someone else.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;
    const body = shareBodySchema.parse(await request.json());

    // All DB reads/checks happen inside this transaction; the actual send happens after
    // it resolves (below), same as POST /api/users' invite email — sendEmail()/sendSms()
    // are network calls to an external provider and shouldn't run while an RLS
    // transaction is held open.
    const { formUrl, formName, organizationId, sender } = await withOrgContext(
      session.user.organizationId,
      async (tx) => {
        const organizationId = requireOrganizationId(session);

        const form = await tx.form.findFirst({
          where: { id, organizationId },
        });
        assertFormViewAccess(form, session.user.id);
        await assertOrgActionsAllowed(tx, organizationId);

        if (form.status !== 'published') {
          throw new InvalidRequestError('This form must be live before it can be sent to anyone.');
        }

        const windowStart = new Date(Date.now() - SHARE_RATE_WINDOW_MS);
        const [recentEmailCount, recentSmsCount] = await Promise.all([
          tx.emailLog.count({
            where: { organizationId, kind: 'form_share', createdAt: { gte: windowStart } },
          }),
          tx.smsLog.count({
            where: { organizationId, kind: 'form_share', createdAt: { gte: windowStart } },
          }),
        ]);
        if (recentEmailCount + recentSmsCount >= SHARE_RATE_LIMIT) {
          throw new InvalidRequestError(
            "You've sent a lot of these recently — please wait a bit before sending more.",
          );
        }

        const organization = await tx.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: { subdomain: true },
        });
        const sender = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { name: true },
        });

        return {
          formUrl: buildOrgFormUrl(organization.subdomain, `/f/${form.slug}`),
          formName: form.name,
          organizationId,
          sender,
        };
      },
    );
    const senderName = userDisplayName(sender?.name ?? session.user.name);

    if (body.channel === 'email') {
      const { subject, html, text } = formShareEmail({
        senderName,
        formName,
        formUrl,
        message: body.message,
      });
      await sendEmail({
        to: body.recipient,
        subject,
        html,
        text,
        kind: 'form_share',
        organizationId,
      });
    } else {
      const message = formShareSms({ senderName, formName, formUrl, message: body.message });
      await sendSms({ to: body.recipient, message, kind: 'form_share', organizationId });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
