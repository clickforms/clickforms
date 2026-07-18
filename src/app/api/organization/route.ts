import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api-errors';
import { logAudit } from '@/lib/audit';
import { withOrgContext } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/session';

// ABN is 11 digits once formatting (spaces) is stripped — not validating the official
// weighted-checksum algorithm here, just enough to catch obvious typos. Optional field,
// so an empty string clears it rather than failing validation.
const ABN_PATTERN = /^\d{11}$/;

const patchOrganizationBodySchema = z.object({
  name: z.string().trim().min(1, 'Organisation name is required').max(200).optional(),
  abn: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ''))
    .refine((value) => value === '' || ABN_PATTERN.test(value), {
      message: 'ABN must be 11 digits',
    })
    .optional(),
  contactName: z.string().trim().max(200).optional(),
  contactEmail: z
    .string()
    .trim()
    .max(255)
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  contactPhone: z.string().trim().max(30).optional(),
});

const ORG_SELECT = {
  id: true,
  name: true,
  subdomain: true,
  abn: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
} as const;

/** Returns the signed-in admin's organization profile. Admins only — see requireRole below. */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);

    const organization = await withOrgContext(session.user.organizationId, (tx) =>
      tx.organization.findFirstOrThrow({
        where: { id: session.user.organizationId },
        select: ORG_SELECT,
      }),
    );

    return NextResponse.json({ organization });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Updates the org's ABN / contact-person details. Admins only. */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const session = await requireSession();
    requireRole(session, ['admin']);
    const body = patchOrganizationBodySchema.parse(await request.json());

    const organization = await withOrgContext(session.user.organizationId, async (tx) => {
      const updated = await tx.organization.update({
        where: { id: session.user.organizationId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.abn !== undefined ? { abn: body.abn === '' ? null : body.abn } : {}),
          ...(body.contactName !== undefined
            ? { contactName: body.contactName === '' ? null : body.contactName }
            : {}),
          ...(body.contactEmail !== undefined
            ? { contactEmail: body.contactEmail === '' ? null : body.contactEmail }
            : {}),
          ...(body.contactPhone !== undefined
            ? { contactPhone: body.contactPhone === '' ? null : body.contactPhone }
            : {}),
        },
        select: ORG_SELECT,
      });

      await logAudit(
        {
          organizationId: session.user.organizationId,
          actorUserId: session.user.id,
          action: 'organization.details_update',
          entityType: 'organization',
          entityId: updated.id,
          metadata: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.abn !== undefined ? { abn: body.abn } : {}),
            ...(body.contactName !== undefined ? { contactName: body.contactName } : {}),
            ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
            ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone } : {}),
          },
        },
        tx,
      );

      return updated;
    });

    return NextResponse.json({ organization });
  } catch (error) {
    return toErrorResponse(error);
  }
}
