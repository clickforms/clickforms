import { NextResponse } from 'next/server';
import { InvalidRequestError, toErrorResponse } from '@/lib/api-errors';
import { sendEmail } from '@/lib/email';
import { contactFormEmail } from '@/lib/emails/templates';

// Same allowlist/size cap the landing page's own upload hint advertises
// (landing-contact-form.tsx: "The file must be either a JPG, JPEG, PNG or PDF.
// Max. File size: 5mb") — enforced here too since a client-side hint is not a guarantee.
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'admin@clickforms.com.au';

/**
 * Public marketing-site contact form (no auth, no organization — this is the one email
 * flow in the app that isn't about an existing tenant). Previously the form built a
 * mailto: link and handed off to the visitor's own mail client instead of hitting a
 * backend at all; this replaces that with a real send through the same sendEmail()/
 * EmailLog pipeline every other transactional email in the app uses.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const firstName = String(formData.get('firstName') ?? '').trim();
    const middleName = String(formData.get('middleName') ?? '').trim();
    const lastName = String(formData.get('lastName') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const concern = String(formData.get('concern') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const file = formData.get('file');

    if (!firstName || !lastName) throw new InvalidRequestError('Name is required.');
    if (!email?.includes('@')) throw new InvalidRequestError('Enter a valid email.');
    if (!concern) throw new InvalidRequestError('Select a type of concern.');
    if (!description) throw new InvalidRequestError('Description is required.');

    let attachment: { filename: string; content: Buffer; contentType?: string } | undefined;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new InvalidRequestError('File exceeds the 5MB limit.');
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        throw new InvalidRequestError('File must be a JPG, JPEG, PNG or PDF.');
      }
      attachment = {
        filename: file.name,
        content: Buffer.from(await file.arrayBuffer()),
        contentType: file.type,
      };
    }

    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    const rendered = contactFormEmail({
      fullName,
      email,
      phone: phone ? `+61 ${phone}` : undefined,
      concern,
      description,
      attachmentFilename: attachment?.filename ?? null,
    });

    await sendEmail({
      to: CONTACT_EMAIL,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachments: attachment ? [attachment] : undefined,
      kind: 'contact_form',
      replyTo: email,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
