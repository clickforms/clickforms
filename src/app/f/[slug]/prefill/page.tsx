import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { FormRendererClient } from '@/app/f/[slug]/form-renderer-client';
import { authOptions } from '@/lib/auth';
import { withOrgContext } from '@/lib/db';
import { sanitizePrefillAnswers } from '@/lib/forms/prefills';
import { type FormSchema, formSchemaSchema } from '@/lib/forms/schema';
import { requireOrganizationId } from '@/lib/session';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ draft?: string; from?: string; open?: string }>;
}

// Admin-only page for sending a prefilled form: renders the live form, the admin fills in
// whatever answers they want pre-populated, and instead of submitting they email it to a
// recipient (POST /api/forms/[id]/prefills). Session-gated.
export default async function FormPrefillPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const draftParam = query?.draft;
  const fromParam = query?.from;
  const openParam = query?.open;

  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    notFound();
  }

  const { form, version, draft, from, reopen } = await withOrgContext(
    session.user.organizationId,
    async (tx) => {
      const form = await tx.form.findFirst({
        where: { slug, organizationId: requireOrganizationId(session) },
      });
      if (!form?.currentVersionId) {
        return { form: null, version: null, draft: null, from: null, reopen: null };
      }
      const version = await tx.formVersion.findFirst({
        where: { id: form.currentVersionId, organizationId: requireOrganizationId(session) },
      });
      // "Continue" on a draft from the Prefills tab: reload its saved answers.
      const draftRows =
        draftParam && /^[0-9a-f-]{36}$/i.test(draftParam)
          ? await tx.$queryRaw<{ id: string; answers: unknown }[]>`
            SELECT id, answers FROM form_prefills
            WHERE id = ${draftParam}::uuid AND form_id = ${form.id}::uuid AND is_draft`
          : [];
      // "Send to someone else": start from another prefill's answers as a brand-new prefill. The
      // source stays exactly as it was sent; this only copies its answers into the builder.
      const fromRows =
        fromParam && /^[0-9a-f-]{36}$/i.test(fromParam)
          ? await tx.$queryRaw<{ answers: unknown; label: string | null }[]>`
            SELECT answers, COALESCE(recipient_name, recipient_email) AS label FROM form_prefills
            WHERE id = ${fromParam}::uuid AND form_id = ${form.id}::uuid`
          : [];
      // "Open" on a sent prefill: edit that same prefill and send it again.
      const reopenRows =
        openParam && /^[0-9a-f-]{36}$/i.test(openParam)
          ? await tx.$queryRaw<{ id: string; answers: unknown; label: string | null }[]>`
            SELECT id, answers, COALESCE(recipient_name, recipient_email) AS label FROM form_prefills
            WHERE id = ${openParam}::uuid AND form_id = ${form.id}::uuid AND NOT is_draft`
          : [];
      return {
        form,
        version,
        draft: draftRows[0] ?? null,
        from: fromRows[0] ?? null,
        reopen: reopenRows[0] ?? null,
      };
    },
  );

  if (!form || !version) {
    // Form exists but isn't live: explain instead of a 404.
    const offline = await withOrgContext(session.user.organizationId, (tx) =>
      tx.form.findFirst({
        where: {
          slug,
          organizationId: requireOrganizationId(session),
          status: { not: 'archived' },
        },
        select: { id: true },
      }),
    );
    if (offline) {
      return (
        <div className="form-renderer">
          <div className="form-renderer-body form-success">
            <h1>This form is not live right now</h1>
            <p>Publish the form again to send prefilled copies of it.</p>
          </div>
        </div>
      );
    }
    notFound();
  }

  const parsed = formSchemaSchema.safeParse(version.schema);
  if (!parsed.success) {
    notFound();
  }
  const schema: FormSchema = parsed.data;

  return (
    <div className="form-preview-shell">
      <div className="form-preview-banner">
        {reopen
          ? `Editing ${reopen.label ?? 'this'} prefill: change what you need, then send it again. Responses already returned stay in the Prefills tab.`
          : from
            ? `Starting from ${from.label ?? 'another'} prefill: change what you need, then send it to someone else. The original stays as it was sent.`
            : 'Fill in the answers you want pre-populated, then send the form. Nothing here is submitted as a response.'}
      </div>
      <FormRendererClient
        slug={form.slug}
        formId={form.id}
        formName={form.name}
        formVersionId={version.id}
        schema={schema}
        previewMode
        prefillBuilder
        draftId={draft?.id}
        reopenId={reopen?.id}
        prefillAnswers={
          draft
            ? sanitizePrefillAnswers(schema, draft.answers)
            : reopen
              ? sanitizePrefillAnswers(schema, reopen.answers)
              : from
                ? sanitizePrefillAnswers(schema, from.answers)
                : undefined
        }
      />
    </div>
  );
}
