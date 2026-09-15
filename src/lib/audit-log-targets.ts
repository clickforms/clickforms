import type { Prisma } from '@prisma/client';
import type { prisma } from '@/lib/db';

export interface AuditLogTargetInput {
  entityType: string;
  entityId: string;
}

/**
 * Resolves a human-readable label for each (entityType, entityId) pair in a batch of
 * audit log entries — e.g. `form_version` becomes the form's name plus version number,
 * `submission` becomes which form it was a response to, `user`/`user_invite` become an
 * email address. Keyed by `${entityType}:${entityId}` so callers can look a label up
 * per row (see src/app/forms/logs/page.tsx).
 *
 * The audit_log row itself never stored this at write time (see src/lib/audit.ts's
 * `metadata` field, which varies per action) — this resolves it by joining against the
 * live tables instead, which also means the label reflects the entity's CURRENT name
 * (e.g. a form renamed after the logged action) rather than what it was called at the
 * time. A form/submission/user deleted since then resolves to no entry in the map at
 * all — callers should fall back to just the entity type in that case.
 */
export async function resolveAuditLogTargets(
  client: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  entries: readonly AuditLogTargetInput[],
): Promise<Map<string, string>> {
  const idsByType = new Map<string, Set<string>>();
  for (const entry of entries) {
    const set = idsByType.get(entry.entityType) ?? new Set<string>();
    set.add(entry.entityId);
    idsByType.set(entry.entityType, set);
  }

  const formIds = new Set<string>(idsByType.get('form') ?? []);
  const formVersionIds = Array.from(idsByType.get('form_version') ?? []);
  const submissionIds = Array.from(idsByType.get('submission') ?? []);
  const userIds = Array.from(idsByType.get('user') ?? []);
  const userInviteIds = Array.from(idsByType.get('user_invite') ?? []);

  // form_version and submission rows both need their parent form's name — collect
  // those form ids into the same `formIds` set rather than querying forms twice.
  const [formVersions, submissions] = await Promise.all([
    formVersionIds.length
      ? client.formVersion.findMany({
          where: { id: { in: formVersionIds }, organizationId },
          select: { id: true, formId: true, versionNumber: true },
        })
      : Promise.resolve([]),
    submissionIds.length
      ? client.submission.findMany({
          where: { id: { in: submissionIds }, organizationId },
          select: { id: true, formId: true, submittedAt: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  for (const version of formVersions) formIds.add(version.formId);
  for (const submission of submissions) formIds.add(submission.formId);

  const [forms, users, userInvites] = await Promise.all([
    formIds.size
      ? client.form.findMany({
          where: { id: { in: Array.from(formIds) }, organizationId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? client.user.findMany({
          where: { id: { in: userIds }, organizationId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    userInviteIds.length
      ? client.userInvite.findMany({
          where: { id: { in: userInviteIds }, organizationId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  const formNameById = new Map(forms.map((form) => [form.id, form.name]));
  const labels = new Map<string, string>();

  for (const formId of idsByType.get('form') ?? []) {
    const name = formNameById.get(formId);
    if (name) labels.set(`form:${formId}`, name);
  }
  for (const version of formVersions) {
    const formName = formNameById.get(version.formId) ?? 'Deleted form';
    labels.set(`form_version:${version.id}`, `${formName} · v${version.versionNumber}`);
  }
  for (const submission of submissions) {
    const formName = formNameById.get(submission.formId) ?? 'Deleted form';
    const when = submission.submittedAt ?? submission.createdAt;
    labels.set(
      `submission:${submission.id}`,
      `${formName} · response ${when.toLocaleDateString('en-AU')}`,
    );
  }
  for (const user of users) {
    labels.set(`user:${user.id}`, user.name ? `${user.name} (${user.email})` : user.email);
  }
  for (const invite of userInvites) {
    labels.set(
      `user_invite:${invite.id}`,
      invite.name ? `${invite.name} (${invite.email})` : invite.email,
    );
  }

  return labels;
}
