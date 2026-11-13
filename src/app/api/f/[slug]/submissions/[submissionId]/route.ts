import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertWithinSubmissionLimit } from '@/lib/admin/plan-enforcement';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { notifyPrefillReturned } from '@/lib/forms/prefill-review';
import { isSignatureDataUrl } from '@/lib/forms/prefills';
import {
  getFormForExistingSubmission,
  getFormSchemaByVersionId,
  getSubmissionForForm,
} from '@/lib/forms/public-lookup';
import { sendSubmissionNotification } from '@/lib/forms/submission-notification';
import { validateAnswers } from '@/lib/forms/validate-answers';
import { log } from '@/lib/log';
import { buildStorageKey, putObjectBytes } from '@/lib/s3';
import { getCurrentSubdomain, resolveOrganizationIdOrThrow } from '@/lib/tenant';

interface RouteContext {
  params: Promise<{ slug: string; submissionId: string }>;
}

const answersBodySchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});

// Final submit — specs/03/04: server-side re-validation "if the client check is
// bypassed via direct API call" is not optional. Re-validates against the exact
// form_version the submission was created against (not whatever's currently published),
// so a mid-fill republish (spec 03 acceptance criteria) never invalidates answers
// already in progress.
export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { slug, submissionId } = await params;
    const body = answersBodySchema.parse(await request.json());

    const organizationId = await resolveOrganizationIdOrThrow();
    const form = await getFormForExistingSubmission(slug, organizationId);
    const submission = await getSubmissionForForm({ formId: form.id, submissionId });

    if (submission.status !== 'in_progress') {
      throw new InvalidRequestError('This submission has already been submitted.');
    }

    const schema = await getFormSchemaByVersionId(submission.formVersionId);

    // Signatures the sender applied in the prefill this response came through are locked: the
    // server takes them from the prefill itself and ignores whatever the browser sent for
    // those fields, so a recipient can't swap, clear or alter the sender's signature.
    const prefillRows = await withOrgContext(
      form.organizationId,
      (tx) =>
        tx.$queryRaw<{ answers: Record<string, unknown> | null }[]>`
        SELECT p.answers FROM submissions s JOIN form_prefills p ON p.id = s.prefill_id
        WHERE s.id = ${submission.id}::uuid`,
    );
    const prefilledAnswers = prefillRows[0]?.answers ?? null;
    const lockedSignatures = new Map<string, string>();
    for (const [fieldId, field] of Object.entries(schema.fields)) {
      const original = prefilledAnswers?.[fieldId];
      if (field.type === 'signature' && isSignatureDataUrl(original)) {
        lockedSignatures.set(fieldId, original);
        // Counts as answered for validation; replaced by a stored file id further down.
        body.answers[fieldId] = original;
      }
    }

    // Every file_upload/signature/draw_on_image answer must reference a
    // submission_files row that was actually uploaded against *this* submission —
    // otherwise a client could forge a fileId belonging to a different org's submission
    // into its answers.
    const uploadedFiles = await withOrgContext(form.organizationId, (tx) =>
      tx.submissionFile.findMany({ where: { submissionId: submission.id }, select: { id: true } }),
    );
    const uploadedFileIds = new Set(uploadedFiles.map((file) => file.id));

    for (const [fieldId, field] of Object.entries(schema.fields)) {
      if (
        field.type !== 'file_upload' &&
        field.type !== 'signature' &&
        field.type !== 'draw_on_image'
      )
        continue;
      if (lockedSignatures.has(fieldId)) continue;
      const value = body.answers[fieldId];
      if (value === undefined) continue;
      const fileIds = Array.isArray(value) ? value : [value];
      for (const fileId of fileIds) {
        if (!uploadedFileIds.has(fileId)) {
          throw new InvalidRequestError(
            `Field "${fieldId}" references a file that was not uploaded to this submission.`,
          );
        }
      }
    }

    const fieldErrors = validateAnswers(schema, body.answers);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors }, { status: 400 });
    }

    // Store each locked signature as a real file on this submission, exactly like one drawn
    // on the form, and point the answer at it.
    for (const [fieldId, dataUrl] of lockedSignatures) {
      const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      const storageKey = buildStorageKey({
        organizationId: form.organizationId,
        formId: form.id,
        submissionId: submission.id,
        filename: 'signature.png',
      });
      await putObjectBytes({ storageKey, bytes, mimeType: 'image/png' });
      const file = await withOrgContext(form.organizationId, (tx) =>
        tx.submissionFile.create({
          data: {
            submissionId: submission.id,
            organizationId: form.organizationId,
            fieldKey: fieldId,
            storageKey,
            filename: 'signature.png',
            mimeType: 'image/png',
            sizeBytes: bytes.byteLength,
          },
        }),
      );
      body.answers[fieldId] = file.id;
    }

    const { updated, organizationNotificationEmail, held, heldLabel } = await withOrgContext(
      form.organizationId,
      async (tx) => {
        // Fetched once up front: `plan` feeds the submissions-cap check right below, and
        // `notificationEmail` is needed later for the fire-and-forget notification send.
        const organization = await tx.organization.findUnique({
          where: { id: form.organizationId },
          select: { plan: true, notificationEmail: true },
        });

        // A response that arrived through an emailed prefill link is held for review in the
        // Prefills tab (when the form has that switched on) rather than landing in Responses.
        const prefillRows = await tx.$queryRaw<
          {
            prefill_id: string | null;
            prefill_held: boolean;
            prefill_recipient: string | null;
            hold: boolean;
          }[]
        >`SELECT s.prefill_id, s.prefill_held, s.prefill_recipient, f.hold_prefilled_responses AS hold
          FROM submissions s JOIN forms f ON f.id = s.form_id
          WHERE s.id = ${submission.id}::uuid`;
        const prefillInfo = prefillRows[0];
        if (prefillInfo?.prefill_held) {
          throw new InvalidRequestError('This submission has already been submitted.');
        }
        const hold = Boolean(prefillInfo?.prefill_id && prefillInfo.hold);

        // Checked immediately before flipping status to 'submitted' — matches exactly
        // what buildUsageBars' "Submissions this month" bar and the admin billing page
        // count, so an org can't finalize more than its plan allows in a calendar month.
        // Public respondent, so this stays neutral rather than an upgrade pitch aimed at
        // someone who can't act on it.
        if (!hold) {
          await assertWithinSubmissionLimit(
            tx,
            form.organizationId,
            organization?.plan ?? 'standard',
          );
        }

        // Held responses keep status 'in_progress' (so every Responses list/count/export
        // already ignores them) and are flagged; promoting flips them to 'submitted'.
        const result = await tx.submission.update({
          where: { id: submission.id },
          data: hold
            ? { answers: body.answers, submittedAt: new Date() }
            : { answers: body.answers, status: 'submitted', submittedAt: new Date() },
        });
        if (hold) {
          await tx.$executeRaw`UPDATE submissions SET prefill_held = true WHERE id = ${result.id}::uuid`;
        }

        await logAudit(
          {
            organizationId: form.organizationId,
            actorUserId: null,
            action: 'submission.submit',
            entityType: 'submission',
            entityId: result.id,
            metadata: { formId: form.id, formVersionId: submission.formVersionId, held: hold },
          },
          tx,
        );

        return {
          updated: result,
          organizationNotificationEmail: organization?.notificationEmail ?? null,
          held: hold ? (prefillInfo?.prefill_id ?? null) : null,
          heldLabel: hold ? (prefillInfo?.prefill_recipient ?? null) : null,
        };
      },
    );

    // Fire-and-forget: rendering the PDF attachment takes a few seconds and a slow/broken
    // SMTP server must never delay or fail the respondent's own submit request — see
    // sendSubmissionNotification's own docs for why every error inside it is caught.
    if (held) {
      void notifyPrefillReturned({
        organizationId: form.organizationId,
        form: {
          id: form.id,
          name: form.name,
          notificationMode: form.notificationMode,
          notificationEmail: form.notificationEmail,
        },
        prefillId: held,
        recipientLabel: heldLabel ?? 'Someone',
        organizationNotificationEmail,
      });
      return NextResponse.json({ submissionId: updated.id, status: 'submitted' });
    }

    const subdomain = await getCurrentSubdomain();
    if (subdomain) {
      void sendSubmissionNotification({
        organizationSubdomain: subdomain,
        form: {
          id: form.id,
          name: form.name,
          slug: form.slug,
          organizationId: form.organizationId,
          notificationMode: form.notificationMode,
          notificationEmail: form.notificationEmail,
          pdfFilenameTemplate: form.pdfFilenameTemplate,
          filenamePrefixFieldId: form.filenamePrefixFieldId,
        },
        submission: {
          id: updated.id,
          formVersionId: updated.formVersionId,
          submittedAt: updated.submittedAt,
          answers: updated.answers as Record<string, unknown>,
        },
        organizationNotificationEmail,
      }).catch((error) => {
        log.error('notification.submission_failed', { submissionId: updated.id, error });
      });
    }

    return NextResponse.json({ submissionId: updated.id, status: updated.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
