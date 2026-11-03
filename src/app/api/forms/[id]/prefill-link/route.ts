import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { withOrgContext } from '@/lib/db';
import { assertFormEditAccess } from '@/lib/form-access';
import { createPrefillToken, sanitizePrefillAnswers } from '@/lib/forms/prefill-token';
import { formSchemaSchema } from '@/lib/forms/schema';
import { requireOrganizationId, requireRole, requireSession } from '@/lib/session';
import { buildOrgFormUrl } from '@/lib/tenant';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ answers: z.record(z.string(), z.unknown()) });

/**
 * Builds a shareable link to the form's public URL with the given answers pre-populated
 * (see lib/forms/prefill-token.ts — the answers travel as an encrypted, expiring token, not
 * readable query params). Only the live (published) version is reachable by respondents, so
 * the link is built against that version's schema and the form must be published.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin', 'editor', 'member']);
    const { id } = await params;
    const { answers } = bodySchema.parse(await request.json());
    const organizationId = requireOrganizationId(session);

    const { form, schemaJson, subdomain } = await withOrgContext(organizationId, async (tx) => {
      const form = await tx.form.findFirst({ where: { id, organizationId } });
      assertFormEditAccess(form, session.user.role, session.user.id);
      if (!form.currentVersionId) {
        throw new InvalidRequestError('Publish the form before creating a prefilled link.');
      }
      const version = await tx.formVersion.findFirst({
        where: { id: form.currentVersionId, organizationId },
      });
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { subdomain: true },
      });
      return { form, schemaJson: version?.schema, subdomain: organization.subdomain };
    });

    const parsed = formSchemaSchema.safeParse(schemaJson);
    if (!parsed.success) {
      throw new InvalidRequestError('The published form could not be read.');
    }

    const clean = sanitizePrefillAnswers(parsed.data, answers);
    if (Object.keys(clean).length === 0) {
      throw new InvalidRequestError('Fill in at least one answer to prefill.');
    }

    const token = createPrefillToken(form.id, clean);
    const url = `${buildOrgFormUrl(subdomain, `/f/${form.slug}`)}?prefill=${token}`;
    return NextResponse.json({ url });
  } catch (error) {
    return toErrorResponse(error);
  }
}
