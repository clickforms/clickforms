import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { FormSettingsClient } from '@/app/forms/[id]/settings/form-settings-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import {
  createEmptyFormSchema,
  formSchemaSchema,
  listFilenamePrefixCandidates,
} from '@/lib/forms/schema';
import { requireOrganizationId } from '@/lib/session';
import { canEditForm, canViewForm } from '@/lib/user-roles';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FormSettingsPage({ params }: PageProps) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  // See the identical comment in src/app/forms/page.tsx — FormsLayout's redirect for a
  // platform-only admin can race with this page's own render, so this page needs its own
  // quiet bail-out rather than assuming the layout always wins first.
  if (!session.user.organizationId) {
    return null;
  }

  const { form, availableFields, organizationNotificationEmail } = await withOrgContext(
    session.user.organizationId,
    async (tx) => {
      const form = await tx.form.findFirst({
        where: { id, organizationId: requireOrganizationId(session) },
        select: {
          id: true,
          name: true,
          createdBy: true,
          isPrivate: true,
          pdfFilenameTemplate: true,
          filenamePrefixFieldId: true,
          notificationMode: true,
          notificationEmail: true,
        },
      });
      if (!form) {
        return { form: null, availableFields: [], organizationNotificationEmail: null };
      }

      // The picker offers fields from the form's current (latest) version — same draft an
      // admin is actively editing in the builder — not necessarily what's live/published,
      // matching how the builder itself always edits the latest version.
      const latestVersion = await tx.formVersion.findFirst({
        where: { formId: form.id },
        orderBy: { versionNumber: 'desc' },
      });
      const parsedSchema = latestVersion ? formSchemaSchema.safeParse(latestVersion.schema) : null;
      const schema = parsedSchema?.success ? parsedSchema.data : createEmptyFormSchema();

      // Shown in the "Use organisation default" option so an admin can see exactly which
      // address that resolves to (or that none is configured) without leaving this page.
      const organization = await tx.organization.findUnique({
        where: { id: requireOrganizationId(session) },
        select: { notificationEmail: true },
      });

      return {
        form,
        availableFields: listFilenamePrefixCandidates(schema),
        organizationNotificationEmail: organization?.notificationEmail ?? null,
      };
    },
  );

  if (!form || !canViewForm(form.isPrivate, form.createdBy, session.user.id)) {
    notFound();
  }

  const canEdit = canEditForm(session.user.role, form.createdBy, session.user.id);

  return (
    <FormSettingsClient
      formId={form.id}
      formName={form.name}
      canEdit={canEdit}
      initialPdfFilenameTemplate={form.pdfFilenameTemplate ?? ''}
      initialFilenamePrefixFieldId={form.filenamePrefixFieldId}
      availableFields={availableFields}
      initialNotificationMode={form.notificationMode}
      initialNotificationEmail={form.notificationEmail}
      organizationNotificationEmail={organizationNotificationEmail}
    />
  );
}
