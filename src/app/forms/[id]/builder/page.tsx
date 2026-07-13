import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { BuilderClient } from '@/app/forms/[id]/builder/builder-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { createEmptyFormSchema, type FormSchema, formSchemaSchema } from '@/lib/forms/schema';
import { canUseBuilder } from '@/lib/user-roles';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FormBuilderPage({ params }: PageProps) {
  const { id } = await params;

  // FormsLayout already redirects unauthenticated requests — this session read can't be
  // null in practice, but requireSession()'s throw-based flow is for API routes, not
  // Server Components (which need redirect(), not a thrown error), so it's re-derived
  // here rather than shared (mirrors src/app/forms/page.tsx).
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  const { form, version } = await withOrgContext(session.user.organizationId, async (tx) => {
    const form = await tx.form.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!form) {
      return { form: null, version: null };
    }

    const version = await tx.formVersion.findFirst({
      where: { formId: form.id },
      orderBy: { versionNumber: 'desc' },
    });

    return { form, version };
  });

  if (!form) {
    notFound();
  }

  let schema: FormSchema;
  if (version) {
    const parsed = formSchemaSchema.safeParse(version.schema);
    if (parsed.success) {
      schema = parsed.data;
    } else {
      // Every write path (POST /api/forms via createEmptyFormSchema, PATCH /api/forms/:id
      // via formSchemaSchema-validated body) only ever persists a schema that already
      // satisfies this validator, so this branch means the JSONB was altered out-of-band.
      // Fail soft with an empty draft rather than 500ing the whole page.
      console.error(
        `[forms/builder] form ${form.id} version ${version.id} has a stored schema that fails formSchemaSchema`,
        parsed.error,
      );
      schema = createEmptyFormSchema();
    }
  } else {
    // Every form is created with an initial draft version (see POST /api/forms) — this
    // shouldn't normally happen, but the client still needs something to render.
    schema = createEmptyFormSchema();
  }

  const canEdit = canUseBuilder(session.user.role, form.createdBy, session.user.id);

  return (
    <BuilderClient
      formId={form.id}
      formName={form.name}
      initialVersion={
        version
          ? {
              id: version.id,
              versionNumber: version.versionNumber,
              publishedAt: version.publishedAt ? version.publishedAt.toISOString() : null,
              schema,
            }
          : null
      }
      canEdit={canEdit}
    />
  );
}
