import 'server-only';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InvalidRequestError } from '@/lib/api-errors';

// Presigned-URL upload/download for submission files and signature images
// (specs/04-submission-handling.md: "client requests a presigned S3 PUT URL... uploads
// directly to S3, not proxied through the app server"). Nothing here ever streams file
// bytes through the Next.js server — it only ever mints short-lived signed URLs.

// specs/04: "Enforce file size limit (e.g. 20MB) and an allowlist of MIME types at
// presign time."
export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

const LOGO_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

let cachedClient: S3Client | null = null;

function getS3Client(): S3Client {
  // Lazily constructed (not at module load) so importing this file doesn't throw in
  // contexts where AWS env vars aren't set yet (e.g. typecheck, or a dev box that hasn't
  // configured S3_BUCKET because the form under test has no file/signature fields).
  if (!cachedClient) {
    // S3_ENDPOINT is unset for real AWS S3 (default AWS endpoint + virtual-hosted addressing),
    // which is the normal case now that the AWS bucket is live (see scripts/setup-s3.sh and
    // scripts/migrate-supabase-to-s3.sh). It can still be pointed at any S3-compatible
    // provider for throwaway local/test buckets — forcePathStyle is required for those since
    // they serve every bucket off one host, not a per-bucket subdomain.
    const endpoint = process.env.S3_ENDPOINT;
    cachedClient = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-2',
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }
  return cachedClient;
}

function getBucketName(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error(
      'S3_BUCKET is not configured. Set S3_BUCKET (and AWS_REGION) in .env.local to enable file/signature uploads — see .env.example.',
    );
  }
  return bucket;
}

function sanitizeFilename(filename: string): string {
  // Strip any path portion and anything unsafe in an S3 key / Content-Disposition header.
  // The original name is preserved verbatim in submission_files.filename for display;
  // this is only what ends up in the storage key itself.
  const base = filename.split(/[/\\]/).pop() ?? 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  return cleaned || 'file';
}

/** Throws InvalidRequestError (→ 400) if the declared size/MIME type isn't allowed.
 * Callers with field-level `validation.acceptedTypes` (spec 02) should additionally
 * check that allowlist themselves — this only enforces the app-wide baseline. */
export function assertUploadAllowed(params: { mimeType: string; sizeBytes: number }): void {
  if (params.sizeBytes <= 0) {
    throw new InvalidRequestError('File is empty.');
  }
  if (params.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    throw new InvalidRequestError(
      `File exceeds the ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB limit.`,
    );
  }
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) {
    throw new InvalidRequestError(`File type "${params.mimeType}" is not allowed.`);
  }
}

/** Form branding logos — images only, smaller cap than submission file uploads. */
export function assertLogoUploadAllowed(params: { mimeType: string; sizeBytes: number }): void {
  if (params.sizeBytes <= 0) {
    throw new InvalidRequestError('File is empty.');
  }
  if (params.sizeBytes > MAX_LOGO_SIZE_BYTES) {
    throw new InvalidRequestError(
      `Logo exceeds the ${MAX_LOGO_SIZE_BYTES / (1024 * 1024)}MB limit.`,
    );
  }
  if (!LOGO_MIME_TYPES.has(params.mimeType)) {
    throw new InvalidRequestError(`Logo must be an image (${[...LOGO_MIME_TYPES].join(', ')}).`);
  }
}

/** Template gallery thumbnails — same image allowlist/size cap as org logos, just a
 * different error message. See src/app/admin/templates. */
export function assertTemplateThumbnailUploadAllowed(params: {
  mimeType: string;
  sizeBytes: number;
}): void {
  if (params.sizeBytes <= 0) {
    throw new InvalidRequestError('File is empty.');
  }
  if (params.sizeBytes > MAX_LOGO_SIZE_BYTES) {
    throw new InvalidRequestError(
      `Thumbnail exceeds the ${MAX_LOGO_SIZE_BYTES / (1024 * 1024)}MB limit.`,
    );
  }
  if (!LOGO_MIME_TYPES.has(params.mimeType)) {
    throw new InvalidRequestError(
      `Thumbnail must be an image (${[...LOGO_MIME_TYPES].join(', ')}).`,
    );
  }
}

/** Storage key layout: org_id/form_id/submission_id/<uuid>-<sanitized filename>
 * (ARCHITECTURE.md §4). The uuid prefix avoids collisions between two uploads to the
 * same field with the same original filename within one submission. */
export function buildStorageKey(params: {
  organizationId: string;
  formId: string;
  submissionId: string;
  filename: string;
}): string {
  const safeName = sanitizeFilename(params.filename);
  return `${params.organizationId}/${params.formId}/${params.submissionId}/${crypto.randomUUID()}-${safeName}`;
}

/** Form field image assets: org_id/form_id/fields/<fieldId>/<uuid>-<filename> */
export function buildFormFieldImageKey(params: {
  organizationId: string;
  formId: string;
  fieldId: string;
  filename: string;
}): string {
  const safeName = sanitizeFilename(params.filename);
  return `${params.organizationId}/${params.formId}/fields/${params.fieldId}/${crypto.randomUUID()}-${safeName}`;
}

/** Org library uploads (Files page): org_id/library/<uuid>-<filename> */
export function buildLibraryStorageKey(params: {
  organizationId: string;
  filename: string;
}): string {
  const safeName = sanitizeFilename(params.filename);
  return `${params.organizationId}/library/${crypto.randomUUID()}-${safeName}`;
}

export function isLibraryStorageKey(params: {
  storageKey: string;
  organizationId: string;
}): boolean {
  const expectedPrefix = `${params.organizationId}/library/`;
  return params.storageKey.startsWith(expectedPrefix);
}

export function isFormFieldImageKey(params: {
  storageKey: string;
  organizationId: string;
  formId: string;
  fieldId: string;
}): boolean {
  const expectedPrefix = `${params.organizationId}/${params.formId}/fields/${params.fieldId}/`;
  return params.storageKey.startsWith(expectedPrefix);
}

/** Org branding logo (workspace sidebar): org_id/logo/<uuid>-<filename> */
export function buildOrganizationLogoKey(params: {
  organizationId: string;
  filename: string;
}): string {
  const safeName = sanitizeFilename(params.filename);
  return `${params.organizationId}/logo/${crypto.randomUUID()}-${safeName}`;
}

export function isOrganizationLogoKey(params: {
  storageKey: string;
  organizationId: string;
}): boolean {
  const expectedPrefix = `${params.organizationId}/logo/`;
  return params.storageKey.startsWith(expectedPrefix);
}

/** Template gallery thumbnail (platform-owned, no organizationId): templates/<template
 * id>/thumbnail/<uuid>-<filename> */
export function buildTemplateThumbnailKey(params: {
  templateId: string;
  filename: string;
}): string {
  const safeName = sanitizeFilename(params.filename);
  return `templates/${params.templateId}/thumbnail/${crypto.randomUUID()}-${safeName}`;
}

export function isTemplateThumbnailKey(params: {
  storageKey: string;
  templateId: string;
}): boolean {
  const expectedPrefix = `templates/${params.templateId}/thumbnail/`;
  return params.storageKey.startsWith(expectedPrefix);
}

/** Signed PUT URL the client uploads directly to (valid 5 minutes). */
export async function createPresignedUploadUrl(params: {
  storageKey: string;
  mimeType: string;
  // Optional, but every call site has this available — it's already validated against
  // the relevant MAX_*_SIZE_BYTES cap (assertUploadAllowed/assertLogoUploadAllowed/
  // assertTemplateThumbnailUploadAllowed) before the presign is minted. Passing it here
  // signs ContentLength into the request, so S3 requires the actual PUT to send a
  // `Content-Length` header matching this exact value or the signature no longer
  // verifies. Without it, the size cap is enforced only against whatever number the
  // client *claims* in its presign request body — nothing stops a caller hitting this
  // API directly (bypassing the browser file input entirely) from declaring a small
  // sizeBytes to pass the check, then PUTing an arbitrarily large body to the resulting
  // URL, since a presigned PUT has no built-in size limit of its own.
  sizeBytes?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: params.storageKey,
    ContentType: params.mimeType,
    ...(params.sizeBytes !== undefined ? { ContentLength: params.sizeBytes } : {}),
  });
  return getSignedUrl(getS3Client(), command, { expiresIn: 300 });
}

// A plain `filename="..."` Content-Disposition param has to fit in Latin-1 (ISO-8859-1) —
// that's the charset AWS (and HTTP headers generally) require for it. macOS screenshot
// filenames are the classic trap here: "Screenshot 2024-01-01 at 5.31.31 PM.png" looks
// like an ordinary space before "PM", but macOS actually writes U+202F (narrow no-break
// space), which is codepoint 8239 — well outside Latin-1 — and S3 rejects the whole
// presigned request with a 400 InvalidArgument ("Header value cannot be represented using
// ISO-8859-1") the moment that filename is echoed back in a download/embed request.
function toLatin1SafeFilename(filename: string): string {
  return Array.from(filename)
    .map((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint <= 0xff ? char : '_';
    })
    .join('')
    .replace(/"/g, '');
}

/** Signed GET URL for the admin submission-detail view to download/preview an uploaded
 * file or signature image (valid 5 minutes — regenerated on every page load, never stored). */
export async function createPresignedDownloadUrl(params: {
  storageKey: string;
  filename: string;
  inline?: boolean;
}): Promise<string> {
  const disposition = params.inline ? 'inline' : 'attachment';
  // filename= is the Latin-1-safe fallback (older clients); filename*= is the RFC 5987
  // UTF-8-encoded form modern browsers prefer, so a name with real non-ASCII characters
  // (not just the macOS-space case above) still downloads with its exact original name.
  const safeFilename = toLatin1SafeFilename(params.filename);
  const encodedFilename = encodeURIComponent(params.filename);
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: params.storageKey,
    ResponseContentDisposition: `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn: 300 });
}

/** Best-effort delete — used when a new org logo replaces an old one, or the logo is
 * removed entirely (src/app/api/organization/logo). Callers should not let a failure
 * here block the database update; an orphaned S3 object is harmless clutter, but a
 * blocked logo change is a broken feature. */
export async function deleteObject(storageKey: string): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: getBucketName(), Key: storageKey });
  await getS3Client().send(command);
}
