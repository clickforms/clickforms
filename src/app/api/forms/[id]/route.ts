import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess, assertFormViewAccess } from '@/lib/form-access';
import { deleteForm } from '@/lib/forms/delete-form';
import {
  restoreStatusAfterUnarchive,
  shouldResetToDraftOnSchemaEdit,
} from '@/lib/forms/form-status';
import { formSchemaSchema } from '@/lib/forms/schema';
import { getOrCreateDraftVersion } from '@/lib/forms/versions';
import { ForbiddenError, requireRole, requireSession } from '@/lib/session';

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
        where: { id, organizationId: session.user.organizationId },
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
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.archived !== undefined ||
      body.schema !== undefined ||
      body.isPrivate !== undefined,
    {
      message: 'Provide at least one of: name, archived, schema, isPrivate',
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
        where: { id, organizationId: session.user.organizationId },
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
            organizationId: session.user.organizationId,
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
            organizationId: session.user.organizationId,
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
            organizationId: session.user.organizationId,
            actorUserId: session.user.id,
            action: body.isPrivate ? 'form.make_private' : 'form.make_visible',
            entityType: 'form',
            entityId: form.id,
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
            organizationId: session.user.organizationId,
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
        where: { id, organizationId: session.user.organizationId },
      });
      assertFormEditAccess(form, session.user.role, session.user.id);

      return deleteForm(tx, form, session.user.id);
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return toErrorResponse(error);
  }
}
