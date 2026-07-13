import type { Prisma } from '@prisma/client';

/**
 * Returns the `form_versions` row the builder should write autosaved edits to, creating
 * a new draft version first if the latest version is already published.
 *
 * specs/02-form-builder.md: "Editing a published form again creates a new draft version,
 * leaving the live one untouched for in-flight submissions." A published version's
 * `schema` must never be mutated after `publishedAt` is set — `submissions.form_version_id`
 * pins in-progress respondent answers to the exact schema they started against (spec 03/04),
 * so changing that JSONB out from under them would corrupt whatever page/field indices
 * they've already used.
 */
export async function getOrCreateDraftVersion(
  tx: Prisma.TransactionClient,
  form: { id: string; organizationId: string },
) {
  const latest = await tx.formVersion.findFirst({
    where: { formId: form.id },
    orderBy: { versionNumber: 'desc' },
  });

  if (!latest) {
    // Every form is created with an initial draft version (see POST /api/forms) — this
    // would only happen if that invariant were broken elsewhere.
    throw new Error(`Form ${form.id} has no versions`);
  }

  if (latest.publishedAt === null) {
    return latest;
  }

  return tx.formVersion.create({
    data: {
      formId: form.id,
      organizationId: form.organizationId,
      schema: latest.schema as Prisma.InputJsonValue,
      versionNumber: latest.versionNumber + 1,
    },
  });
}
