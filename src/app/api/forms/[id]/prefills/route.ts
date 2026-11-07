import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertOrgActionsAllowed } from '@/lib/admin/plan-enforcement';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { generatePrefillToken, PREFILL_TTL_MS, sanitizePrefillAnswers } from '@/lib/forms/prefills';
import { configuredResponseLabel } from '@/lib/forms/response-label';
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
  // 'email' sends the recipient their link; 'link' just creates it so the admin can copy and
  // share it themselves (text message, chat, etc.).
  // 'draft' just saves the half-filled prefill ("Save and complete later"); nothing is sent.
  delivery: z.enum(['email', 'link', 'draft']).default('email'),
  /** An existing draft being continued — updated in place rather than creating a new row. */
  draftId: z.string().uuid().optional(),
  /** A sent prefill being edited in place and sent again (new link, same row). */
  reopenId: z.string().uuid().optional(),
  recipientEmail: z.string().trim().email('Enter a valid email address').optional(),
  /** Several recipients at once — one separate prefill (own link, own response) per address. */
  recipientEmails: z
    .array(z.string().trim().email('Enter valid email addresses'))
    .max(25)
    .optional(),
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
    const emailTargets =
      body.delivery === 'email'
        ? [
            ...new Set(
              [
                ...(body.recipientEmails ?? []),
                ...(body.recipientEmail ? [body.recipientEmail] : []),
              ].map((e) => e.toLowerCase()),
            ),
          ]
        : [];
    if (body.delivery === 'email' && emailTargets.length === 0) {
      throw new InvalidRequestError('Enter the recipient’s email address.');
    }
    // One entry per prefill to create; `null` = a link-only prefill (nothing emailed).
    const targets: (string | null)[] = body.delivery === 'email' ? emailTargets : [null];
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
      const isDraft = body.delivery === 'draft';
      // A label for drafts in the Prefills tab: whatever name/email the admin has filled in.
      let draftLabel: string | null = null;
      if (isDraft) {
        const labelRows = await tx.$queryRaw<{ response_label_field_id: string | null }[]>`
          SELECT response_label_field_id FROM forms WHERE id = ${form.id}::uuid`;
        draftLabel =
          body.recipientName ??
          configuredResponseLabel(
            parsed.data,
            labelRows[0]?.response_label_field_id ?? null,
            answers,
          );
      }

      if (isDraft) {
        const draftExpiry = new Date(Date.now() + PREFILL_TTL_MS);
        if (body.draftId) {
          const updated = await tx.$executeRaw`
            UPDATE form_prefills
            SET answers = ${JSON.stringify(answers)}::jsonb, recipient_name = ${draftLabel},
                expires_at = ${draftExpiry}
            WHERE id = ${body.draftId}::uuid AND form_id = ${form.id}::uuid AND is_draft`;
          if (updated === 0) throw new NotFoundError('Draft');
          return { draftSavedId: body.draftId };
        }
        const draftRows = await tx.$queryRaw<{ id: string }[]>`
          INSERT INTO form_prefills
            (organization_id, form_id, created_by, recipient_name, token, answers, is_draft, expires_at)
          VALUES
            (${organizationId}::uuid, ${form.id}::uuid, ${session.user.id}::uuid, ${draftLabel},
             ${generatePrefillToken()}, ${JSON.stringify(answers)}::jsonb, true, ${draftExpiry})
          RETURNING id`;
        return { draftSavedId: draftRows[0]?.id ?? null };
      }

      const windowStart = new Date(Date.now() - SEND_RATE_WINDOW_MS);
      const recent = await tx.emailLog.count({
        where: { organizationId, kind: 'form_prefill', createdAt: { gte: windowStart } },
      });
      if (recent + targets.length > SEND_RATE_LIMIT) {
        throw new InvalidRequestError(
          "You've sent a lot of these recently. Please wait a bit before sending more.",
        );
      }

      const expiresAt = new Date(Date.now() + PREFILL_TTL_MS);
      const created: { id: string; token: string; email: string | null }[] = [];
      for (const [index, emailTo] of targets.entries()) {
        const token = generatePrefillToken();
        if (index === 0 && body.draftId) {
          // Finishing a draft: same row, now real (sent or shared as a link).
          const finished = await tx.$executeRaw`
            UPDATE form_prefills
            SET answers = ${JSON.stringify(answers)}::jsonb, recipient_email = ${emailTo},
                recipient_name = ${body.recipientName || null}, token = ${token}, is_draft = false,
                sent_at = ${emailTo ? new Date() : null}, expires_at = ${expiresAt}
            WHERE id = ${body.draftId}::uuid AND form_id = ${form.id}::uuid AND is_draft`;
          if (finished === 0) throw new NotFoundError('Draft');
          created.push({ id: body.draftId, token, email: emailTo });
          continue;
        }
        if (index === 0 && body.reopenId) {
          // Re-sending an existing prefill: same row, updated answers, a fresh link and clock.
          // Responses that already came back stay linked to it.
          const reopened = await tx.$executeRaw`
            UPDATE form_prefills
            SET answers = ${JSON.stringify(answers)}::jsonb, recipient_email = ${emailTo},
                recipient_name = ${body.recipientName || null}, token = ${token},
                sent_at = now(), opened_at = NULL, expires_at = ${expiresAt}
            WHERE id = ${body.reopenId}::uuid AND form_id = ${form.id}::uuid AND NOT is_draft`;
          if (reopened === 0) throw new NotFoundError('Prefill');
          created.push({ id: body.reopenId, token, email: emailTo });
          continue;
        }
        // Each recipient gets their own row with a frozen copy of the answers as sent.
        const rows = await tx.$queryRaw<{ id: string }[]>`
          INSERT INTO form_prefills
            (organization_id, form_id, created_by, recipient_email, recipient_name, token, answers, sent_at, expires_at)
          VALUES
            (${organizationId}::uuid, ${form.id}::uuid, ${session.user.id}::uuid, ${emailTo},
             ${emailTargets.length > 1 ? null : body.recipientName || null}, ${token}, ${JSON.stringify(answers)}::jsonb,
             ${emailTo ? new Date() : null}, ${expiresAt})
          RETURNING id`;
        const row = rows[0];
        if (row) created.push({ id: row.id, token, email: emailTo });
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
        created,
        expiresAt,
        slug: form.slug,
        formName: form.name,
        subdomain: organization.subdomain,
        senderName: userDisplayName(sender?.name ?? session.user.name),
      };
    });

    if ('draftSavedId' in created) {
      return NextResponse.json({ id: created.draftSavedId, draft: true }, { status: 201 });
    }

    const results = created.created.map((item) => ({
      id: item.id,
      email: item.email,
      url: prefillUrl(created.subdomain, created.slug, item.token),
    }));
    for (const item of results) {
      if (!item.email) continue;
      await sendPrefillEmail({
        to: item.email,
        recipientName: emailTargets.length > 1 ? null : body.recipientName,
        senderName: created.senderName,
        formName: created.formName,
        url: item.url,
        note: body.note,
        expiresAt: created.expiresAt,
        organizationId,
      });
    }

    return NextResponse.json(
      { id: results[0]?.id, url: results[0]?.url, results },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
