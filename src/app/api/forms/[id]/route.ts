import type { FormNotificationMode } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess, assertFormViewAccess } from '@/lib/form-access';
import { deleteForm } from '@/lib/forms/delete-form';
import {
  restoreStatusAfterUnarchive,
  shouldResetToDraftOnSchemaEdit,
} from '@/lib/forms/form-status';
import { formSchemaSchema, listFilenamePrefixCandidates } from '@/lib/forms/schema';
import { getOrCreateDraftVersion } from '@/lib/forms/versions';
import { ForbiddenError, requireOrganizationId, requireRole, requireSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET returns the form plus whichever version the builder should be editing right now —
// the latest by versionNumber, which is the pending draft if one exists, or the live
// published version read-only otherwise (the first PATCH with a `schema` change is what
// actually forks a fresh draft — see getOrCreateDraftVersion).
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const { id } = await params;

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: requireOrganizationId(session) },
      });
      assertFormViewAccess(form, session.user.id);

      const editingVersion = await tx.formVersion.findFirst({
        where: { formId: form.id },
        orderBy: { versionNumber: 'desc' },
      });

      return { form, version: editingVersion };
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

const patchFormBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    archived: z.boolean().optional(),
    schema: formSchemaSchema.optional(),
    isPrivate: z.boolean().optional(),
    // Empty string clears a custom template back to the default naming — see
    // resolveFilenameTemplate in src/lib/forms/generate-submission-pdf.ts.
    pdfFilenameTemplate: z.string().trim().max(150).optional(),
    // The field backing the `{prefix}` token in pdfFilenameTemplate above. Explicit null
    // clears it back to "no prefix configured" (mirrors pdfFilenameTemplate's empty-string
    // convention, but null rather than '' since a field id is never a meaningful empty
    // string). Checked against the form's own current schema below, not trusted as-is.
    filenamePrefixFieldId: z.string().min(1).nullable().optional(),
    // Who gets emailed on a new response — see src/lib/forms/submission-notification.ts.
    // Always sent together with notificationEmail by the Settings page's single "Response
    // notifications" save action, so the handler below can treat this as the one signal
    // that either field changed.
    notificationMode: z
      .enum(['org_default', 'custom', 'off'] satisfies readonly FormNotificationMode[])
      .optional(),
    notificationEmail: z
      .string()
      .trim()
      .max(255)
      .email('Invalid email address')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (body) =>
      body.notificationMode !== 'custom' ||
      (body.notificationEmail !== undefined && body.notificationEmail !== ''),
    {
      message: 'notificationEmail is required when notificationMode is "custom"',
      path: ['notificationEmail'],
    },
  )
  .refine(
    (body) =>
      body.name !== undefined ||
      body.archived !== undefined ||
      body.schema !== undefined ||
      body.isPrivate !== undefined ||
      body.pdfFilenameTemplate !== undefined ||
      body.filenamePrefixFieldId !== undefined ||
      body.notificationMode !== undefined,
    {
      message:
        'Provide at least one of: name, archived, schema, isPrivate, pdfFilenameTemplate, filenamePrefixFieldId, notificationMode',
    },
  );

// Handles three independent edits in one route, matching what the builder UI needs to
// autosave without a network round trip per keystroke class: rename, archive/restore,
// and schema autosave (draft-only — see getOrCreateDraftVersion for why a published
// version's schema is never touched in place).
export async function PATCH(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;
    const body = patchFormBodySchema.parse(await request.json());

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: requireOrganizationId(session) },
      });
      assertFormEditAccess(form, session.user.role, session.user.id);

      // The privacy toggle is creator-only, deliberately narrower than the general edit
      // gate above: "truly private" (see formsListWhere/canViewForm) means admins/editors
      // can't see a form once it's private, so they shouldn't be able to make that call on
      // someone else's form in the first place either.
      if (body.isPrivate !== undefined && form.createdBy !== session.user.id) {
        throw new ForbiddenError('Only the form creator can change its visibility');
      }

      if (body.name !== undefined) {
        await tx.form.update({ where: { id: form.id }, data: { name: body.name } });
        await logAudit(
          {
            organizationId: requireOrganizationId(session),
            actorUserId: session.user.id,
            action: 'form.rename',
            entityType: 'form',
            entityId: form.id,
            metadata: { name: body.name },
          },
          tx,
        );
      }

      if (body.archived !== undefined) {
        const nextStatus = body.archived
          ? 'archived'
          : restoreStatusAfterUnarchive(form.currentVersionId);
        await tx.form.update({ where: { id: form.id }, data: { status: nextStatus } });
        await logAudit(
          {
            organizationId: requireOrganizationId(session),
            actorUserId: session.user.id,
            action: body.archived ? 'form.archive' : 'form.restore',
            entityType: 'form',
            entityId: form.id,
          },
          tx,
        );
      }

      if (body.isPrivate !== undefined) {
        await tx.form.update({ where: { id: form.id }, data: { isPrivate: body.isPrivate } });
        await logAudit(
          {
            organizationId: requireOrganizationId(session),
            actorUserId: session.user.id,
            action: body.isPrivate ? 'form.make_private' : 'form.make_visible',
            entityType: 'form',
            entityId: form.id,
          },
          tx,
        );
      }

      if (body.pdfFilenameTemplate !== undefined) {
        await tx.form.update({
          where: { id: form.id },
          data: {
            pdfFilenameTemplate: body.pdfFilenameTemplate === '' ? null : body.pdfFilenameTemplate,
          },
        });
        await logAudit(
          {
            organizationId: requireOrganizationId(session),
            actorUserId: session.user.id,
            action: 'form.pdf_filename_template_update',
            entityType: 'form',
            entityId: form.id,
            metadata: { pdfFilenameTemplate: body.pdfFilenameTemplate },
          },
          tx,
        );
      }

      if (body.filenamePrefixFieldId !== undefined) {
        if (body.filenamePrefixFieldId !== null) {
          // Validate against the form's current (latest) schema — the same one the
          // Settings page's picker was built from — rather than trusting a client-sent
          // id outright. A submission's *own* historical schema is checked separately at
          // export time (see the export route), so a field removed after this save still
          // resolves correctly for old responses; this check only guards what a new save
          // is allowed to point at going forward.
          const latestVersion = await tx.formVersion.findFirst({
            where: { formId: form.id },
            orderBy: { versionNumber: 'desc' },
          });
          const parsedSchema = latestVersion
            ? formSchemaSchema.safeParse(latestVersion.schema)
            : null;
          const isEligible =
            parsedSchema?.success &&
            listFilenamePrefixCandidates(parsedSchema.data).some(
              (candidate) => candidate.id === body.filenamePrefixFieldId,
            );
          if (!isEligible) {
            throw new InvalidRequestError(
              'filenamePrefixFieldId must reference a text-like field on this form',
            );
          }
        }

        await tx.form.update({
          where: { id: form.id },
          data: { filenamePrefixFieldId: body.filenamePrefixFieldId },
        });
        await logAudit(
          {
            organizationId: requireOrganizationId(session),
            actorUserId: session.user.id,
            action: 'form.filename_prefix_field_update',
            entityType: 'form',
            entityId: form.id,
            metadata: { filenamePrefixFieldId: body.filenamePrefixFieldId },
          },
          tx,
        );
      }

      if (body.notificationMode !== undefined) {
        // A stale custom address must never linger unseen once mode is switched away
        // from 'custom' — cleared here rather than left in the column, so the Settings
        // page's "Use organisation default" / "Off" choices can't silently resurrect an
        // old override just by flipping the mode back to 'custom' later.
        const notificationEmail =
          body.notificationMode === 'custom' ? body.notificationEmail || null : null;

        await tx.form.update({
          where: { id: form.id },
          data: { notificationMode: body.notificationMode, notificationEmail },
        });
        await logAudit(
          {
            organizationId: requireOrganizationId(session),
            actorUserId: session.user.id,
            action: 'form.notification_settings_update',
            entityType: 'form',
            entityId: form.id,
            metadata: { notificationMode: body.notificationMode, notificationEmail },
          },
          tx,
        );
      }

      let version = null;
      if (body.schema !== undefined) {
        const draft = await getOrCreateDraftVersion(tx, form);
        version = await tx.formVersion.update({
          where: { id: draft.id },
          data: { schema: body.schema },
        });
        if (shouldResetToDraftOnSchemaEdit(form.status)) {
          await tx.form.update({ where: { id: form.id }, data: { status: 'draft' } });
        }
        await logAudit(
          {
            organizationId: requireOrganizationId(session),
            actorUserId: session.user.id,
            action: 'form.autosave',
            entityType: 'form_version',
            entityId: version.id,
          },
          tx,
        );
      }

      const updatedForm = await tx.form.findFirstOrThrow({ where: { id: form.id } });
      return { form: updatedForm, version };
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Permanently deletes a form and all of its versions, submissions, and related data. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;

    const result = await withOrgContext(session.user.organizationId, async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: requireOrganizationId(session) },
      });
      assertFormEditAccess(form, session.user.role, session.user.id);

      return deleteForm(tx, form, session.user.id);
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return toErrorResponse(error);
  }
}
