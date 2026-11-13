import { NextResponse } from 'next/server';
import { assertWithinSubmissionLimit } from '@/lib/admin/plan-enforcement';
import { InvalidRequestError, NotFoundError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { sendSubmissionNotification } from '@/lib/forms/submission-notification';
import { log } from '@/lib/log';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string; prefillId: string }>;
}

/** Promotes the response held under a prefill to a normal response: it now shows in Responses and
 * counts toward the plan, and the usual "new response" notification goes out. The prefill itself
 * (with its original answers) stays, so it can still be compared or deleted afterwards. */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id, prefillId } = await params;
    const organizationId = requireOrganizationId(session);

    const promoted = await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({ where: { id, organizationId } });
      assertFormEditAccess(form, session.user.role, session.user.id);

      const held = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM submissions
        WHERE prefill_id = ${prefillId}::uuid AND form_id = ${form.id}::uuid AND prefill_held
        ORDER BY created_at DESC`;
      const submissionId = held[0]?.id;
      if (!submissionId) throw new InvalidRequestError('There is no returned response to promote.');

      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { plan: true, notificationEmail: true, subdomain: true },
      });
      await assertWithinSubmissionLimit(tx, organizationId, organization.plan);

      await tx.$executeRaw`
        UPDATE submissions SET status = 'submitted', prefill_held = false
        WHERE id = ${submissionId}::uuid`;
      const submission = await tx.submission.findFirst({ where: { id: submissionId } });
      if (!submission) throw new NotFoundError('Submission');

      await logAudit(
        {
          organizationId,
          actorUserId: session.user.id,
          action: 'submission.promote',
          entityType: 'submission',
          entityId: submissionId,
          metadata: { formId: form.id, prefillId },
        },
        tx,
      );
      return { form, submission, organization };
    });

    // Fire-and-forget, same as a normal submit (PDF rendering is slow).
    void sendSubmissionNotification({
      organizationSubdomain: promoted.organization.subdomain,
      form: {
        id: promoted.form.id,
        name: promoted.form.name,
        slug: promoted.form.slug,
        organizationId,
        notificationMode: promoted.form.notificationMode,
        notificationEmail: promoted.form.notificationEmail,
        pdfFilenameTemplate: promoted.form.pdfFilenameTemplate,
        filenamePrefixFieldId: promoted.form.filenamePrefixFieldId,
      },
      submission: {
        id: promoted.submission.id,
        formVersionId: promoted.submission.formVersionId,
        submittedAt: promoted.submission.submittedAt,
        answers: promoted.submission.answers as Record<string, unknown>,
      },
      organizationNotificationEmail: promoted.organization.notificationEmail,
    }).catch((error) => {
      log.error('notification.promote_failed', { prefillId, error });
    });

    return NextResponse.json({ submissionId: promoted.submission.id });
  } catch (error) {
    return toErrorResponse(error);
  }
}
