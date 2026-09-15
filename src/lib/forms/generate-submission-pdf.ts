import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Prisma } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';
import type { FormSchema } from '@/lib/forms/schema';
import { createPresignedDownloadUrl } from '@/lib/s3';

export async function generateSubmissionPdfFromPreviewUrl(
  previewUrl: string,
  cookieHeader: string | null,
): Promise<Buffer> {
  // Explicit, guaranteed-writable, per-invocation profile dir — belt-and-braces
  // alongside the Dockerfile's `ENV HOME=/tmp` fix for the exact same underlying
  // issue (Chromium's crashpad crash-reporting subsystem computing paths from
  // $HOME/the default profile dir and failing when that's missing/unwritable,
  // surfacing as "chrome_crashpad_handler: --database is required"). A fresh dir
  // per call also means two admins exporting PDFs at the same time never race on
  // a shared default profile.
  const userDataDir = join(tmpdir(), `clickforms-pdf-${randomUUID()}`);

  const browser = await puppeteer.launch({
    headless: true,
    // In production this points at the system Chromium installed via apt (see
    // Dockerfile) — Puppeteer's own Chrome-for-Testing download is skipped at
    // build time because it doesn't reliably ship linux-arm64 builds. Locally,
    // this env var is unset and Puppeteer falls back to its normal downloaded
    // browser.
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // Docker's default /dev/shm is 64MB, which Chrome reliably exhausts and
      // crashes on mid-render; fall back to disk-backed shared memory instead.
      '--disable-dev-shm-usage',
      // Debian's `chromium` apt package (see Dockerfile) ships with crashpad crash
      // reporting on by default, which tries to spawn `chrome_crashpad_handler` on
      // launch — that subprocess needs a --database directory Puppeteer never
      // configures, so it exits immediately ("chrome_crashpad_handler: --database
      // is required") and takes the whole browser launch down with it in
      // production ("Failed to launch the browser process"). This feature is only
      // useful for reporting Chrome's own crashes upstream to Google, which we'd
      // never see anyway — disable it outright rather than configuring a dump dir.
      '--disable-crash-reporter',
    ],
  });

  try {
    const page = await browser.newPage();
    // The preview page reads this header to skip rendering the "Submission
    // preview" banner entirely (see src/app/f/[slug]/submissions/[submissionId]/preview/page.tsx).
    // We used to strip the banner client-side via page.evaluate() after load,
    // but that raced with React hydration — the DOM mutation could land while
    // React was still hydrating the page, throwing a hydration-mismatch error
    // in the (headless, but real) browser console. Skipping it server-side
    // avoids the mutation, and the race, entirely.
    const headers: Record<string, string> = { 'x-forms-pdf-export': '1' };
    if (cookieHeader) {
      headers.cookie = cookieHeader;
    }
    await page.setExtraHTTPHeaders(headers);

    // Puppeteer's default viewport (800x600) is what actually lays out the page's CSS —
    // page.pdf()'s width/height below only set the *output paper size*, not the layout
    // viewport, and nothing sizes the two to match on its own. Left at the default, the
    // page renders its content at 800px wide, then gets printed onto an ~960px-usable-
    // width page (11in minus the margins below): different Chromium builds handle that
    // mismatch differently (scale to fit vs. clip at the paper edge), which is exactly
    // why exports looked fine locally (Puppeteer's own bundled Chrome-for-Testing) but
    // came out with content cut off along the right edge in production (Debian's
    // apt-installed `chromium`, a different build entirely — see Dockerfile). Setting an
    // explicit viewport matching the printable width (960px, the same width
    // .export-form's own max-width targets — see submission-export-styles.ts) removes
    // the ambiguity outright, independent of whichever Chromium build renders it.
    await page.setViewport({ width: 960, height: 1280 });

    await page.goto(previewUrl, { waitUntil: 'load', timeout: 30_000 });

    // page.pdf() defaults to Chromium's separate "print" CSS media pipeline,
    // which can render subtly differently from what's actually shown on the
    // preview page admins review before exporting (font metrics, form-control
    // chrome, etc.) — our export stylesheet has no @media print rules of its
    // own to compensate. Forcing "screen" emulation makes the PDF match the
    // preview pixel-for-pixel instead of drifting from it.
    await page.emulateMediaType('screen');

    const pdf = await page.pdf({
      // A4's 8.27in width, minus the 0.5in side margins below, leaves only
      // ~698px of usable content — well short of .export-form's 960px
      // max-width, so that cap never actually kicks in and every field
      // renders visibly narrower/more cramped than on the live/preview form.
      // 11in wide minus the same margins works out to exactly 960px of
      // usable content, so the export hits the same 960px width the live
      // form does on a normal desktop viewport. Height stays at A4's to
      // leave per-page vertical pagination unchanged.
      width: '11in',
      height: '11.69in',
      printBackground: true,
      // 16px read as cramped against the page edge — especially on page 2+,
      // where a section pushed down by break-inside: avoid landed right at
      // the top margin with no breathing room. Standard document margins
      // (~0.5–0.6in) read as a real printed page instead of a screenshot.
      margin: { top: '0.6in', right: '0.5in', bottom: '0.6in', left: '0.5in' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
    // Chrome doesn't clean this up itself on close — left alone, every export would
    // leak a profile directory under /tmp indefinitely.
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Characters invalid (or awkward) in a downloaded filename across Windows/macOS/Linux —
// deliberately narrower than a full filesystem-reserved-char list, just enough to stop a
// custom template from producing a broken or confusing download.
const FILENAME_UNSAFE_CHARS = /[/\\:*?"<>|]/g;
const MAX_TEMPLATE_FILENAME_LENGTH = 150;

// Matches `{field:<id>}` tokens the Settings page inserts when an admin clicks/drags one
// of a form's own questions into the filename format (see FormSettingsClient) — the
// generalized, multi-field successor to the older single `{prefix}` token below. Field
// ids in this app are UUIDs, but the char class is intentionally a bit looser than a
// strict UUID pattern so it still matches if that ever changes.
const FIELD_TOKEN_PATTERN = /\{field:([a-zA-Z0-9_-]+)\}/g;

/**
 * Swaps the recognized tokens in a custom filename template for real values:
 * `{date}` (case-insensitive) becomes the response's submitted date (YYYY-MM-DD, same as
 * the default naming); `{field:<id>}` becomes that field's answer via `answers`; the
 * older singular `{prefix}` token becomes `legacyPrefixValue` (see
 * resolveFilenamePrefixValue) — kept working for any form that configured it before the
 * Settings page moved to picking individual fields directly. Everything else in the
 * template is kept as literal text exactly as typed — deliberately NOT
 * slugified/lowercased like submissionPdfFilename's default, since the whole point of a
 * custom template is to control the casing/spacing yourself (e.g. "Faith Devitt - {date}").
 */
export function resolveFilenameTemplate(
  template: string,
  submittedAt: Date | null,
  answers: Record<string, unknown> = {},
  legacyPrefixValue?: string | null,
): string {
  const datePart = submittedAt
    ? submittedAt.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const resolved = template
    // Token values come from respondent answers, not the admin-typed template text
    // itself, so each gets the same unsafe-character stripping as the rest of the
    // template rather than being trusted as pre-sanitized.
    .replace(/\{prefix\}/gi, (legacyPrefixValue ?? '').replace(FILENAME_UNSAFE_CHARS, ''))
    .replace(FIELD_TOKEN_PATTERN, (_match, fieldId: string) =>
      resolveFilenameFieldValue(answers, fieldId).replace(FILENAME_UNSAFE_CHARS, ''),
    )
    .replace(/\{date\}/gi, datePart)
    .replace(FILENAME_UNSAFE_CHARS, '')
    .trim()
    .slice(0, MAX_TEMPLATE_FILENAME_LENGTH);

  return `${resolved || 'response'}.pdf`;
}

/** Plain-string/number answers only (see FILENAME_PREFIX_ELIGIBLE_FIELD_TYPES in
 * schema.ts, enforced by which fields the Settings page even offers as chips) — a
 * missing answer, a null fieldId, or an unexpectedly-shaped answer (e.g. the field's type
 * changed after this token was inserted) all just resolve to '' rather than throwing, so
 * a bad export never blocks a response's PDF download. */
function resolveFilenameFieldValue(answers: Record<string, unknown>, fieldId: string): string {
  const raw = answers[fieldId];
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return String(raw);
  return '';
}

/** Pulls the raw answer for `prefixFieldId` off a submission's answers, for the older
 * singular `{prefix}` token (see resolveFilenameTemplate's docs — superseded by
 * per-field `{field:<id>}` tokens, but still resolved for backward compatibility with
 * any form that configured it before that change). */
export function resolveFilenamePrefixValue(
  answers: Record<string, unknown>,
  prefixFieldId: string | null,
): string | null {
  if (!prefixFieldId) return null;
  const value = resolveFilenameFieldValue(answers, prefixFieldId);
  return value || null;
}

/**
 * Default naming when a form has no custom template set (see Form.pdfFilenameTemplate) —
 * slugified form name + submitted date, e.g. "intake-form-2026-09-08.pdf".
 */
export function submissionPdfFilename(
  formName: string,
  submittedAt: Date | null,
  template?: string | null,
  answers?: Record<string, unknown>,
  legacyPrefixValue?: string | null,
): string {
  if (template?.trim()) {
    return resolveFilenameTemplate(template, submittedAt, answers, legacyPrefixValue);
  }

  const base = formName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  const datePart = submittedAt
    ? submittedAt.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return `${base || 'submission'}-${datePart}.pdf`;
}

export interface UploadedPdfFile {
  filename: string;
  storageKey: string;
}

/**
 * Appends the pages of any uploaded PDF files (file_upload answers whose mimeType is
 * application/pdf — the field defaults to accepting only png/jpeg/pdf, see
 * createDefaultField) onto the end of the generated submission summary PDF, so the one
 * download contains both the answers and whatever document the respondent attached,
 * rather than leaving the upload as a separate thing the admin has to remember to fetch
 * on its own. Uploaded images are handled separately (embedded as pictures in a trailing
 * "Attachments" page of the summary itself — see build-submission-export-assets.ts and
 * SubmissionFormExportDocument) since those don't need a separate merge step; this only
 * ever runs for PDFs. Both respect the field's embedInExport opt-out (schema.ts). */
export async function appendUploadedPdfPages(
  baseSummaryPdf: Buffer,
  pdfFiles: UploadedPdfFile[],
): Promise<Buffer> {
  if (pdfFiles.length === 0) return baseSummaryPdf;

  const merged = await PDFDocument.load(baseSummaryPdf);

  for (const file of pdfFiles) {
    try {
      const url = await createPresignedDownloadUrl({
        storageKey: file.storageKey,
        filename: file.filename,
      });
      const response = await fetch(url);
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const uploaded = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copiedPages = await merged.copyPages(uploaded, uploaded.getPageIndices());
      for (const page of copiedPages) {
        merged.addPage(page);
      }
    } catch (error) {
      // A malformed/corrupted/password-protected uploaded PDF shouldn't take the whole
      // export down with it — the admin still gets the answers summary, just without
      // that one attachment merged in.
      console.error(`[forms] failed to merge uploaded PDF "${file.filename}" into export`, error);
    }
  }

  const mergedBytes = await merged.save();
  return Buffer.from(mergedBytes);
}

/** Every file_upload answer whose uploaded file is a PDF — these get their pages merged
 * onto the end of the exported summary via appendUploadedPdfPages above, rather than just
 * shown as a filename. Shared by both the manual "Download PDF" export route and the
 * submission-notification email's attachment (src/lib/forms/submission-notification.ts) —
 * originally lived only in the export route, moved here once a second caller needed it. */
export async function findUploadedPdfAttachments(
  tx: Prisma.TransactionClient,
  schema: FormSchema,
  answers: Record<string, unknown>,
  submissionId: string,
  organizationId: string,
): Promise<UploadedPdfFile[]> {
  const fileIds = new Set<string>();
  for (const field of Object.values(schema.fields)) {
    if (field.type !== 'file_upload') continue;
    // Same opt-out that governs inline image embedding (SubmissionFormExportDocument) —
    // a field with embedInExport === false keeps its upload out of the PDF entirely,
    // whether it's an image or (here) a PDF to merge in.
    if (field.embedInExport === false) continue;
    const raw = answers[field.id];
    const values = Array.isArray(raw)
      ? raw.filter((entry): entry is string => typeof entry === 'string')
      : typeof raw === 'string' && raw
        ? [raw]
        : [];
    for (const value of values) fileIds.add(value);
  }
  if (fileIds.size === 0) return [];

  const files = await tx.submissionFile.findMany({
    where: { id: { in: [...fileIds] }, submissionId, organizationId },
    select: { filename: true, storageKey: true, mimeType: true },
  });

  return files
    .filter((file) => file.mimeType === 'application/pdf')
    .map((file) => ({ filename: file.filename, storageKey: file.storageKey }));
}
